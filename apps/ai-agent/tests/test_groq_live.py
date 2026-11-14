"""Live Groq checks. Skipped unless you opt in, so the normal suite stays offline and free:

    RUN_LIVE_GROQ=1 GROQ_API_KEY=gsk_... python -m pytest tests/test_groq_live.py -q

They use a handful of tiny requests (a few hundred tokens in total).
"""
import asyncio
import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

import pytest  # noqa: E402

pytestmark = pytest.mark.skipif(not (os.environ.get("RUN_LIVE_GROQ") == "1" and os.environ.get("GROQ_API_KEY")), reason="set RUN_LIVE_GROQ=1 and GROQ_API_KEY to run")


def test_the_configured_model_is_available_to_this_key():
    import httpx

    from app.core.config import settings

    r = httpx.get("https://api.groq.com/openai/v1/models", headers={"Authorization": f"Bearer {os.environ['GROQ_API_KEY']}"}, timeout=20)
    assert r.status_code == 200
    ids = {m["id"] for m in r.json()["data"]}
    assert settings.GROQ_MODEL in ids and settings.GROQ_FAST_MODEL in ids


def test_streaming_returns_tokens_and_a_clean_finish_reason():
    from app.services.ai_service import AIService

    async def go():
        svc = AIService()
        return [e async for e in svc.astream_segments([{"role": "user", "content": "Reply with exactly: pong"}], max_tokens=200)]

    events = asyncio.run(go())
    assert "".join(v for k, v in events if k == "token").strip().lower().startswith("pong")
    assert events[-1] == ("finish", "stop")


def test_a_tiny_token_limit_triggers_automatic_continuation_without_duplication():
    from app.services.ai_service import AIService

    async def go():
        svc = AIService()
        return [e async for e in svc.astream_complete([{"role": "user", "content": "Count from 1 to 60 separated by commas, nothing else."}], max_tokens=40)]

    events = asyncio.run(go())
    text = "".join(v for k, v in events if k == "token")
    assert events[-1][0] == "done" and events[-1][1]["continuations"] >= 1
    numbers = [int(x) for x in text.replace("\n", " ").replace(",", " ").split() if x.isdigit()]
    # What the code guarantees is the splice: counting is gap-free and repeat-free across the continuation point.
    # (The model may end its continuation early on its own, even mid-number, so the final item is not checked.)
    assert len(numbers) > 12 and numbers[:-1] == list(range(1, len(numbers)))


def test_fast_model_returns_parseable_json():
    from app.services.ai_service import AIService

    out = asyncio.run(AIService().agenerate_json("Photosynthesis", 'Return {"topic": "<one word>"}', fast=True, max_tokens=500))
    assert isinstance(out, dict) and out.get("topic")
