"""
Q&A endpoints, backed by the tutoring harness (app.services.harness).

  POST /api/qa/         one-shot JSON answer
  POST /api/qa/stream   Server-Sent Events: stage progress, tokens as they are generated, then the final result

Both return the same final payload, including a `cognitive_trace` block for the CognitiveTraceCard and a
per-stage `pipeline` timing trace. Mastery and gamification updates go to the in-process message bus so
they never block the response.
"""
import asyncio
import json
import logging
import math
import time
from typing import Any, AsyncIterator, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, model_validator

from app.bus import TOPIC_GAMIFICATION, TOPIC_MASTERY, get_bus
from app.services import harness
from app.services.mastery_service import compute_user_metrics

logger = logging.getLogger(__name__)
router = APIRouter()


class QAInput(BaseModel):
    question: str = Field(default="", description="User question")
    # Aliases sent by the Next.js proxy
    user_prompt: Optional[str] = None
    system_prompt: Optional[str] = None

    userId: Optional[str] = None
    language: Optional[str] = "en"
    collection_name: Optional[str] = "default"
    conversation_history: Optional[List[Dict[str, Any]]] = None

    @model_validator(mode="after")
    def resolve_question(self) -> "QAInput":
        """Accept user_prompt as alias for question (sent by the Next.js proxy)."""
        if not self.question and self.user_prompt:
            self.question = self.user_prompt
        return self


@router.get("/greeting")
async def get_greeting():
    return {"greeting": "Hi! I'm Entropy AI. Ask me anything and I'll explain it step by step."}


@router.get("/health")
async def qa_health():
    from app.core.vector_store import get_vector_store

    return {"status": "healthy", "backend": "Entropy tutoring harness (Groq)", "vector_store": get_vector_store().backend}


def _kwargs(p: QAInput) -> Dict[str, Any]:
    return dict(
        question=p.question.strip(),
        user_id=p.userId,
        language=p.language or "en",
        collection=p.collection_name or "default",
        history=p.conversation_history,
        system_prompt=p.system_prompt,
    )


async def _finish(p: QAInput, r: Dict[str, Any], t0: float) -> Dict[str, Any]:
    """Shape the harness result for the frontend and fire the mastery / XP side effects."""
    inference_ms = round((time.time() - t0) * 1000)
    difficulty_norm = round(min(1.0, max(0.0, int(r.get("difficulty_level") or 5) / 10.0)), 2)
    confidence = float(r.get("confidence_score") or 0.8)
    concept = r.get("concept") or ""

    if p.userId and r.get("mode") != "refused":
        bus = get_bus()
        if concept:
            await bus.publish(TOPIC_MASTERY, {"user_id": p.userId, "concept": concept, "confidence": confidence, "event_type": "chat"})
        await bus.publish(TOPIC_GAMIFICATION, {
            "user_id": p.userId,
            "event_type": "qa_answered",
            "metadata": {"concept": concept, "confidence": confidence, "difficulty": int(r.get("difficulty_level") or 5)},
        })

    metrics: Dict[str, Any] = {}
    if p.userId:
        try:
            m = await compute_user_metrics(p.userId, current_difficulty=difficulty_norm)
            metrics = {
                "cognitive_load": m.cognitive_load,
                "volatility": m.volatility,
                "consistency": m.consistency,
                "exam_readiness": m.exam_readiness,
                "domain_coverage": m.domain_coverage,
            }
        except Exception:
            pass

    return {
        "answer": r.get("answer", ""),
        "concept": concept,
        "prerequisites": r.get("prerequisites", []),
        "stepwise_reasoning": r.get("stepwise_reasoning", []),
        "hint_ladder": r.get("hint_ladder", []),
        "confidence_score": confidence,
        "related_concepts": r.get("related_concepts", []),
        "sources": r.get("sources", []),
        "mode": r.get("mode", "reasoning_engine"),
        "follow_up_questions": r.get("follow_up_questions") or (r.get("related_concepts") or [])[:3],
        "nli_verdict": r.get("nli_verdict"),
        "nli_confidence": r.get("nli_confidence"),
        "nli_flags": int(r.get("nli_flags") or 0),
        "nli_issues": r.get("nli_issues", []),
        "graph": r.get("graph"),
        "nli": r.get("nli"),
        "answer_note": r.get("answer_note", ""),
        "completion": r.get("completion", {}),
        "tools": r.get("tools", []),
        "guardrails": r.get("guardrails", {}),
        "steps": r.get("steps", []),
        "pipeline": r.get("trace", []),
        "cognitive_trace": {
            "intent": r.get("intent_detected", "Learning"),
            "concept": concept,
            "difficulty": difficulty_norm,
            "mastery_impact": max(1, min(5, math.ceil(confidence * 5))),
            "language": r.get("language") or p.language or "en",
            "inference_ms": inference_ms,
            "reasoning_layers": 8,
            **metrics,
            "sources": r.get("sources", []),
        },
    }


@router.post("/", summary="Ask a question")
async def post_qa(payload: QAInput):
    if not payload.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    t0 = time.time()
    try:
        result = await harness.run_to_completion(**_kwargs(payload))
    except RuntimeError as exc:
        if type(exc).__name__ == "AINotConfigured":
            raise  # mapped to HTTP 503 by the app-level handler
        logger.exception("QA pipeline failed")
        raise HTTPException(status_code=502, detail="The reasoning engine could not produce an answer. Please try again.")
    return await _finish(payload, result, t0)


def _sse(event: str, data: Any) -> str:
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"


HEARTBEAT_SECONDS = 10  # comment frames keep proxies (Render, Vercel, nginx) from closing an idle-looking stream


@router.post("/stream", summary="Ask a question, streamed as Server-Sent Events")
async def post_qa_stream(payload: QAInput):
    """SSE contract (what the browser relies on):

        event: stage | tool | meta | token | continuation   progress, safe to render as they arrive
        event: final                                        the complete, validated result
        event: error                                        the run failed; no final follows
        event: done                                         ALWAYS last. {"ok": true|false}

    A stream that ends without `done` was cut off in transit (network, proxy timeout, deploy) and the client must
    treat it as incomplete rather than show the partial text as a finished answer. Lines starting with ":" are
    heartbeats and carry no data. If the client disconnects, the generator is closed, which cancels the harness
    tasks and closes the upstream Groq stream - nothing keeps burning tokens for a gone reader.
    """
    if not payload.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    t0 = time.time()

    async def events() -> AsyncIterator[str]:
        source = harness.run(**_kwargs(payload)).__aiter__()
        pending: Optional[asyncio.Future] = None
        ok = False
        try:
            while True:
                if pending is None:
                    pending = asyncio.ensure_future(source.__anext__())
                finished, _ = await asyncio.wait({pending}, timeout=HEARTBEAT_SECONDS)
                if not finished:
                    yield ": ping\n\n"
                    continue
                try:
                    ev = pending.result()
                except StopAsyncIteration:
                    break
                finally:
                    pending = None
                kind = ev["type"]
                if kind == "final":
                    yield _sse("final", await _finish(payload, ev["result"], t0))
                    ok = True
                elif kind == "error":
                    yield _sse("error", {"message": ev.get("message", "The reasoning engine could not answer."), "code": ev.get("code", "internal")})
                else:
                    yield _sse(kind, {k: v for k, v in ev.items() if k != "type"})
        except asyncio.CancelledError:
            raise  # client went away: finally below still runs
        except Exception:
            logger.exception("QA stream failed")
            yield _sse("error", {"message": "The reasoning engine hit an unexpected error.", "code": "internal"})
        finally:
            if pending is not None and not pending.done():
                pending.cancel()
            try:
                await source.aclose()
            except Exception:  # already closing
                pass
        yield _sse("done", {"ok": ok})

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )
