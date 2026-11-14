"""Harness behaviour with the LLM and every external store faked: no network."""
import asyncio

import pytest

from app.services import harness


class FakeAI:
    """Streams a canned answer; JSON calls fail, like a rate-limited or unavailable fast model."""

    async def astream_complete(self, messages, system=None, **_):
        for tok in ["**Hi.** ", "Binary search halves the range."]:
            yield "token", tok
        yield "done", {"finish_reason": "stop", "continuations": 0, "truncated": False}

    async def agenerate_json(self, *_, **__):
        raise RuntimeError("fast model unavailable")


async def _nothing(ctx):
    return None


@pytest.fixture(autouse=True)
def isolated(monkeypatch):
    monkeypatch.setattr(harness, "get_ai_service", lambda: FakeAI())
    # Replace every stage that touches an external service; keep the real generate/verify logic
    keep = {"normalize", "generate", "verify", "understand"}
    stages = [harness.Stage(s.name, s.fn if s.name in keep else _nothing, s.timeout, s.deps) for s in harness.STAGES]
    monkeypatch.setattr(harness, "STAGES", stages)

    async def no_growth(_ctx):
        return None

    monkeypatch.setattr(harness, "_grow_graph", no_growth)


def _run(**kw):
    return asyncio.run(harness.run_to_completion(question="How does binary search work?", **kw))


def test_answer_survives_a_failed_helper_model():
    out = _run()
    assert out["answer"].startswith("**Hi.**")
    trace = {t["stage"]: t["status"] for t in out["trace"]}
    assert trace["understand"] == "error"  # recorded, not raised
    assert trace["generate"] == "done"


def test_failed_verification_is_reported_as_unverified_not_pass():
    out = _run()
    assert out["nli_verdict"] == "UNVERIFIED"
    assert out["confidence_score"] <= 0.7


def test_all_eight_stages_are_traced():
    out = _run()
    names = {t["stage"] for t in out["trace"]}
    assert {"normalize", "understand", "graph", "learner", "documents", "web", "generate", "verify"} <= names


def test_tokens_stream_before_the_final_event():
    async def collect():
        return [e["type"] async for e in harness.run(question="q")]

    kinds = asyncio.run(collect())
    assert kinds.index("token") < kinds.index("final")
    assert kinds[-1] == "final"


def test_missing_llm_key_surfaces_as_not_configured(monkeypatch):
    from app.services.ai_service import AINotConfigured

    class Broken(FakeAI):
        async def astream_complete(self, *a, **k):
            raise AINotConfigured("GROQ_API_KEY is not configured.")
            yield  # pragma: no cover

    monkeypatch.setattr(harness, "get_ai_service", lambda: Broken())
    with pytest.raises(AINotConfigured):
        _run()
