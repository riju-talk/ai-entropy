"""
NOVYRA — Barebones Gemini LLM client (google.genai SDK)
"""
import json
import logging
from typing import Optional
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception

from google import genai
from google.genai import types
from google.genai.errors import ClientError


def _should_retry(exc: BaseException) -> bool:
    """Only retry on transient server errors — NOT on 429 quota, 404, 401, 403."""
    if isinstance(exc, ClientError):
        msg = str(exc)
        no_retry_codes = ("429", "404", "401", "403")
        if any(code in msg for code in no_retry_codes):
            return False
    return True

from app.core.config import settings

logger = logging.getLogger(__name__)

# Configure client once at import time
_client: genai.Client | None = None

if settings.GOOGLE_API_KEY:
    _client = genai.Client(api_key=settings.GOOGLE_API_KEY)
    logger.info("Gemini SDK (google.genai) configured with model: %s", settings.LLM_MODEL)
else:
    logger.warning("GOOGLE_API_KEY not set — Gemini calls will fail")


def _get_client() -> genai.Client:
    if _client is None:
        raise RuntimeError("GOOGLE_API_KEY not configured")
    return _client


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10), retry=retry_if_exception(_should_retry))
async def generate_text(
    prompt: str,
    system_prompt: str = "You are a helpful AI tutor.",
    temperature: float | None = None,
) -> str:
    """Single-turn text generation — returns plain string."""
    client = _get_client()
    full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
    config = types.GenerateContentConfig(
        temperature=temperature if temperature is not None else settings.LLM_TEMPERATURE,
        max_output_tokens=4096,
    )
    response = await client.aio.models.generate_content(
        model=settings.LLM_MODEL,
        contents=full_prompt,
        config=config,
    )
    return response.text.strip()


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10), retry=retry_if_exception(_should_retry))
async def generate_json(
    prompt: str,
    system_prompt: str = "You are a helpful AI tutor. Respond ONLY with valid JSON.",
    temperature: float | None = None,
) -> dict:
    """Generate structured JSON output — retries up to 3 times."""
    client = _get_client()
    full_prompt = (
        f"{system_prompt}\n\n"
        f"CRITICAL: Your entire response must be a single valid JSON object.\n"
        f"Do NOT include markdown code fences, just raw JSON.\n\n"
        f"{prompt}"
    )
    config = types.GenerateContentConfig(
        temperature=temperature if temperature is not None else settings.LLM_TEMPERATURE,
        max_output_tokens=4096,
    )
    response = await client.aio.models.generate_content(
        model=settings.LLM_MODEL,
        contents=full_prompt,
        config=config,
    )
    text = response.text.strip()

    # Strip code fences if model added them anyway
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        logger.error("JSON parse failed: %s | raw: %s", exc, text[:300])
        raise ValueError(f"LLM did not return valid JSON: {exc}") from exc


# Alias for chat_service compatibility
async def generate_response(prompt: str) -> str:
    """Alias: single-turn generation, returns text string."""
    return await generate_text(prompt)

