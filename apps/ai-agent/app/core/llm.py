"""Entropy AI — LLM client (delegates to bedrock_service)"""
import asyncio
import json
import logging

from app.core.config import settings
from app.services.bedrock_service import get_bedrock_service

logger = logging.getLogger(__name__)


async def _run_sync(fn, *args, **kwargs):
    """Run a blocking call in the default thread-pool executor."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, lambda: fn(*args, **kwargs))


async def generate_text(
    prompt: str,
    system_prompt: str = "You are a helpful AI tutor.",
    temperature: float | None = None,
) -> str:
    """Single-turn text generation — returns plain string."""
    svc = get_bedrock_service()
    temp = temperature if temperature is not None else settings.LLM_TEMPERATURE
    return await _run_sync(svc.generate, prompt, system=system_prompt, temperature=temp)


async def generate_json(
    prompt: str,
    system_prompt: str = "You are a helpful AI tutor. Respond ONLY with valid JSON.",
    temperature: float | None = None,
) -> dict:
    """Generate structured JSON output — retries up to 3 times."""
    svc = get_bedrock_service()
    temp = temperature if temperature is not None else settings.LLM_TEMPERATURE
    json_system = (
        system_prompt
        + "\n\nCRITICAL: Your entire response must be a single valid JSON object. "
        + "Do NOT include markdown code fences, just raw JSON."
    )
    for attempt in range(3):
        raw = await _run_sync(svc.generate, prompt, system=json_system, temperature=temp)
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


async def generate_response(prompt: str) -> str:
    """Alias for chat_service compatibility."""
    return await generate_text(prompt)