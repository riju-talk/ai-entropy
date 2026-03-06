"""
NOVYRA — LLM client
Routes to Bedrock (Claude 3 Sonnet) or Gemini based on AI_PROVIDER env var.

  AI_PROVIDER=bedrock  → Amazon Bedrock (Claude 3 Sonnet)  ← AWS production
  AI_PROVIDER=gemini   → Google Gemini SDK                 ← local dev default
"""
import json
import logging
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Provider selection
# ─────────────────────────────────────────────────────────────────────────────
_PROVIDER = getattr(settings, "AI_PROVIDER", "gemini").lower()

# ── Gemini setup (only if provider == gemini) ─────────────────────────────────
_gemini_client = None
if _PROVIDER == "gemini":
    try:
        from google import genai
        from google.genai import types as _gtypes
        from google.genai.errors import ClientError as _GClientError

        def _should_retry_gemini(exc: BaseException) -> bool:
            if isinstance(exc, _GClientError):
                msg = str(exc)
                if any(c in msg for c in ("429", "404", "401", "403")):
                    return False
            return True

        if settings.GOOGLE_API_KEY:
            _gemini_client = genai.Client(api_key=settings.GOOGLE_API_KEY)
            logger.info("Gemini SDK configured — model: %s", settings.LLM_MODEL)
        else:
            logger.warning("GOOGLE_API_KEY not set — Gemini calls will fail")
    except ImportError:
        logger.warning("google-generativeai not installed — Gemini unavailable")

# ── Bedrock setup (only if provider == bedrock) ───────────────────────────────
_bedrock_client = None
if _PROVIDER == "bedrock":
    try:
        import boto3
        from botocore.config import Config as _BConfig
        _bedrock_client = boto3.client(
            "bedrock-runtime",
            config=_BConfig(
                region_name=getattr(settings, "AWS_REGION", "ap-northeast-1"),
                retries={"max_attempts": 3, "mode": "adaptive"},
            ),
        )
        logger.info("Bedrock client configured — model: %s", getattr(settings, "BEDROCK_CLAUDE_MODEL", ""))
    except ImportError:
        logger.warning("boto3 not installed — Bedrock unavailable")


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

async def _generate_gemini(prompt: str, system_prompt: str, temperature: float) -> str:
    from google.genai import types as gtypes
    client = _gemini_client
    if client is None:
        raise RuntimeError("Gemini client not initialised. Check GOOGLE_API_KEY.")
    full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
    config = gtypes.GenerateContentConfig(
        temperature=temperature,
        max_output_tokens=4096,
    )
    response = await client.aio.models.generate_content(
        model=settings.LLM_MODEL,
        contents=full_prompt,
        config=config,
    )
    return response.text.strip()


async def _generate_bedrock(prompt: str, system_prompt: str, temperature: float) -> str:
    import asyncio
    model_id = getattr(settings, "BEDROCK_CLAUDE_MODEL", "anthropic.claude-3-sonnet-20240229-v1:0")
    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 4096,
        "temperature": temperature,
        "system": system_prompt,
        "messages": [{"role": "user", "content": prompt}],
    })
    # boto3 is synchronous — run in executor to keep async loop unblocked
    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None,
        lambda: _bedrock_client.invoke_model(
            modelId=model_id,
            contentType="application/json",
            accept="application/json",
            body=body,
        ),
    )
    result = json.loads(response["body"].read())
    return result["content"][0]["text"].strip()


# ─────────────────────────────────────────────────────────────────────────────
# Public API (same surface as before — dropping in is transparent)
# ─────────────────────────────────────────────────────────────────────────────

async def generate_text(
    prompt: str,
    system_prompt: str = "You are a helpful AI tutor.",
    temperature: float | None = None,
) -> str:
    """Single-turn text generation — returns plain string."""
    temp = temperature if temperature is not None else settings.LLM_TEMPERATURE
    if _PROVIDER == "bedrock":
        return await _generate_bedrock(prompt, system_prompt, temp)
    return await _generate_gemini(prompt, system_prompt, temp)


async def generate_json(
    prompt: str,
    system_prompt: str = "You are a helpful AI tutor. Respond ONLY with valid JSON.",
    temperature: float | None = None,
) -> dict:
    """Generate structured JSON output — retries up to 3 times."""
    temp = temperature if temperature is not None else settings.LLM_TEMPERATURE
    json_system = (
        system_prompt
        + "\n\nCRITICAL: Your entire response must be a single valid JSON object. "
        + "Do NOT include markdown code fences, just raw JSON."
    )
    for attempt in range(3):
        if _PROVIDER == "bedrock":
            raw = await _generate_bedrock(prompt, json_system, temp)
        else:
            raw = await _generate_gemini(prompt, json_system, temp)

        raw = raw.strip()
        if raw.startswith("```"):
            raw = "\n".join(raw.split("\n")[1:]).rstrip("`").strip()
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("generate_json attempt %d failed to parse JSON", attempt + 1)
            if attempt == 2:
                logger.error("generate_json: all 3 attempts failed — raw: %s", raw[:200])
                return {}
    return {}



# Alias for chat_service compatibility
async def generate_response(prompt: str) -> str:
    """Alias: single-turn generation, returns text string."""
    return await generate_text(prompt)

