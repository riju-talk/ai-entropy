"""
Tutoring harness: the 8-stage reasoning pipeline as a small dependency graph.

    normalize ──► understand ──► graph ─────┐
         │                                  │
         ├──► documents (Pinecone/Postgres) ┼──► generate (streams) ──► verify
         └──► web (Tavily)                  │
    learner ────────────────────────────────┘

Why a graph instead of a list: every stage starts the moment its inputs are ready, so retrieval, graph
lookup and learner state overlap instead of queueing, and the first token streams as soon as the
context is assembled. Each stage has its own timeout and a safe default, so one slow or broken
dependency (Neo4j down, no Tavily key, empty vector store) degrades the answer instead of failing it.

Latency budget (typical on Groq): understand ~0.3 s (8B model) in parallel with retrieval, first token
~1-2 s, answer streams at model speed, verify (8B model) arrives after the answer is already on screen.

Events yielded by `run()`:
    {"type": "stage", "name", "status": start|done|timeout|error|skipped, "ms"}
    {"type": "meta",  "concept", "intent", "sources": [...], "graph": {...}}
    {"type": "token", "text"}
    {"type": "final", "result": {... same shape the Q&A route has always returned ...}}
    {"type": "error", "message", "code"}
"""
from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Awaitable, Callable, Dict, List, Optional

from app.services.ai_service import AINotConfigured, get_ai_service

logger = logging.getLogger(__name__)

INTENTS = ["concept_explanation", "problem_solving", "comparison", "procedure", "clarification", "example_request", "factual", "open_ended"]

TUTOR_SYSTEM = """You are a warm, precise AI tutor. Help the student truly understand, not just receive an answer.

Write in Markdown only (never JSON). Layout:
- One-line **bold** summary first, with no heading above it.
- Short ## sections (e.g. ## Explanation, ## Example, ## Common mistakes), --- between major sections.
- Numbered lists for steps, bullets otherwise, fenced code blocks for code, **bold** for key terms.
- End with ## Summary: 2-3 bullets.
Be concise: roughly 250-450 words unless the question truly needs more. No emojis.
The interface cannot render LaTeX: write math in plain text or Unicode (x^2, sqrt(x), f(x) = (x-3)^2, ∇f, ≤), never in $...$ or LaTeX parentheses form.

Grounding rules:
- When numbered sources are provided, cite them inline as [1], [2] where they support a claim. Cite ONLY provided sources and never invent URLs or citations. If sources do not cover the question, answer from general knowledge and say so briefly.
- If you are unsure, say what you are unsure about instead of guessing.
- Adapt depth to the learner profile if one is given; mention a prerequisite only if it is likely a gap."""

UNDERSTAND_SYSTEM = f"""You analyse a student's question for a tutoring system. Return JSON:
{{"intent": one of {INTENTS},
 "concepts": [{{"name": "canonical English textbook name", "confidence": 0.0-1.0}}] (1-3 core concepts the question is about),
 "difficulty": integer 1-10,
 "domain": "short subject area"}}
Concept names must be about the QUESTION, written in English, 1-4 words, e.g. "Gradient Descent", "Binary Search"."""

REVIEW_SYSTEM = """You review a tutor's answer: fact-check it and prepare study aids. Return ONE JSON object:
{"verdict": "PASS" | "REVIEW" | "FLAG",
 "confidence": 0.0-1.0 (how confident you are the answer is correct),
 "issues": ["up to 3 specific problem claims; empty if none"],
 "steps": ["3-5 short reasoning steps that lead to the answer"],
 "hints": ["2-3 progressive hints, from a gentle nudge to a concrete step, that do NOT reveal the full answer"],
 "misconceptions": ["1-2 common mistakes"],
 "prerequisites": ["0-4 English concept names to know first"],
 "related": ["0-4 English concept names to study next"],
 "follow_ups": ["2-3 natural follow-up questions the student may ask"]}
Fact-checking rules:
- Provided SOURCES are ground truth for this question. They may describe private, course-specific or fictional material, so never penalise an answer because the topic is not publicly known. A claim that matches a source is correct.
- REVIEW: a claim that adds specific facts the sources do not support. FLAG: a claim that contradicts the sources.
- With no sources, judge against well-established knowledge: PASS if accurate, REVIEW if a claim is doubtful, FLAG if clearly wrong.
- Style, length and formatting are not errors. No emojis."""


# ── context + stage plumbing ──────────────────────────────────────────────────────────────────

@dataclass
class Ctx:
    question: str
    user_id: Optional[str] = None
    language: str = "en"
    collection: str = "default"
    history: List[Dict[str, Any]] = field(default_factory=list)
    system_prompt: Optional[str] = None
    include_hints: bool = True

    working_question: str = ""
    intent: str = "concept_explanation"
    concepts: List[str] = field(default_factory=list)
    difficulty: int = 5
    domain: str = ""
    graph: Optional[Dict[str, Any]] = None
    collective: Dict[str, Any] = field(default_factory=dict)
    learner: Optional[Dict[str, Any]] = None
    doc_sources: List[Dict[str, Any]] = field(default_factory=list)
    web_sources: List[Dict[str, Any]] = field(default_factory=list)
    web_context: str = ""
    sources: List[Dict[str, Any]] = field(default_factory=list)
    evidence: List[str] = field(default_factory=list)
    answer: str = ""
    aux: Dict[str, Any] = field(default_factory=dict)
    verify: Dict[str, Any] = field(default_factory=dict)
    trace: List[Dict[str, Any]] = field(default_factory=list)
    errors: Dict[str, BaseException] = field(default_factory=dict)
    emit: Optional[Callable[[dict], None]] = None

    @property
    def concept(self) -> str:
        if self.graph and self.graph.get("name"):
            return self.graph["name"]
        return self.concepts[0] if self.concepts else ""


@dataclass
class Stage:
    name: str
    fn: Callable[[Ctx], Awaitable[None]]
    timeout: float
    deps: tuple = ()


# ── stages ────────────────────────────────────────────────────────────────────────────────────

async def normalize(ctx: Ctx) -> None:
    """1. Make sure the rest of the pipeline sees English (translation only when needed)."""
    ctx.working_question = ctx.question
    from app.services import multilingual_service as ml

    if ctx.language != "en" or ml._is_non_latin(ctx.question):
        ctx.working_question = await ml.to_english(ctx.question, source_lang=ctx.language if ctx.language != "en" else "auto")


async def understand(ctx: Ctx) -> None:
    """2. Intent + concepts + difficulty in ONE call on the fast model (was three sequential LLM calls)."""
    out = await get_ai_service().agenerate_json(ctx.working_question, UNDERSTAND_SYSTEM, fast=True, max_tokens=300)
    if out.get("intent") in INTENTS:
        ctx.intent = out["intent"]
    names = [c.get("name") for c in out.get("concepts", []) if isinstance(c, dict) and c.get("name")]
    ctx.concepts = [n.strip() for n in names if n.strip()][:3]
    try:
        ctx.difficulty = max(1, min(10, int(out.get("difficulty") or 5)))
    except (TypeError, ValueError):
        pass
    ctx.domain = str(out.get("domain") or "")[:40]


async def graph(ctx: Ctx) -> None:
    """3. Knowledge graph: resolve the concept, then prerequisites / unlocks / related / the learner's mastery."""
    from app.services import knowledge_graph_service as kg

    ctx.collective = await kg.get_concepts_matching_question(ctx.working_question)
    # If the model could not name the concept, fall back to graph concepts mentioned in the question itself
    names = ctx.concepts or list(ctx.collective)[:2]
    results = await asyncio.gather(*(kg.get_graph_context(n, ctx.user_id) for n in names[:2]), return_exceptions=True)
    ctx.graph = next((r for r in results if isinstance(r, dict)), None)
    if not ctx.concepts:
        ctx.concepts = names


async def learner(ctx: Ctx) -> None:
    """4. Learner state: overall mastery and what they struggle with (skipped for anonymous users)."""
    if not ctx.user_id:
        return
    from app.services.ai_brain.cognitive_state import compute_cognitive_state

    s = await compute_cognitive_state(ctx.user_id)
    ctx.learner = {
        "mastery": float(s.overall_mastery),
        "struggling": [c.concept_name for c in s.struggling_concepts[:3]],
        "level": "beginner" if s.overall_mastery < 0.3 else "advanced" if s.overall_mastery > 0.7 else "intermediate",
    }


async def documents(ctx: Ctx) -> None:
    """5. The learner's own material (Pinecone, or Postgres when Pinecone isn't configured)."""
    from app.core.vector_store import get_vector_store

    hits = await get_vector_store().query(ctx.collection, ctx.working_question, k=5)
    seen: set = set()
    ctx.doc_sources = []
    for h in hits:
        key = h.get("text", "").strip()
        if not key or key in seen or h["score"] < 0.3:  # below 0.3 the match is noise and would mislead the model
            continue
        seen.add(key)
        ctx.doc_sources.append({"title": h["source"] or "Document", "url": "", "snippet": key[:400], "type": "document", "score": round(h["score"], 3), "_text": key[:900]})
    ctx.doc_sources = ctx.doc_sources[:4]


async def web(ctx: Ctx) -> None:
    """6. Live web results (Tavily). A no-op when no key is configured."""
    from app.services.tavily_service import get_tavily_service

    svc = get_tavily_service()
    if not svc.available:
        return
    results = await svc.search(ctx.working_question, max_results=4)
    ctx.web_sources = [dict(r, type="web") for r in (results or [])]


def _number_sources(ctx: Ctx) -> str:
    """Give every source one number across documents and web, and render the prompt block."""
    ctx.sources = []
    ctx.evidence = []
    lines: List[str] = []
    for s in ctx.doc_sources + ctx.web_sources:
        n = len(ctx.sources) + 1
        text = s.pop("_text", None) or s.get("snippet") or s.get("content") or ""
        ctx.sources.append({"index": n, "title": s.get("title") or "Source", "url": s.get("url") or "", "snippet": (s.get("snippet") or text)[:400], "type": s.get("type", "web")})
        where = "your uploaded material" if s.get("type") == "document" else s.get("url", "web")
        lines.append(f"[{n}] {s.get('title') or 'Source'} ({where})\n{text[:700]}")
        ctx.evidence.append(f"[{n}] {text[:700]}")
    return "\n\n".join(lines)


def _build_prompt(ctx: Ctx, source_block: str) -> str:
    parts: List[str] = []
    if ctx.learner:
        l = ctx.learner
        parts.append(f"Learner profile: {l['level']} (overall mastery {l['mastery']:.2f})" + (f"; struggles with {', '.join(l['struggling'])}" if l["struggling"] else ""))
    if ctx.graph:
        g = ctx.graph
        bits = [f"Concept: {g['name']}" + (f" (difficulty {g['difficulty']}/10)" if g.get("difficulty") else "")]
        if g.get("description"):
            bits.append(g["description"])
        gaps = [p["name"] for p in g["prerequisites"] if not p.get("mastered")]
        if g["prerequisites"]:
            bits.append("Prerequisites: " + ", ".join(p["name"] for p in g["prerequisites"][:4]) + (f" (learner may need review: {', '.join(gaps[:2])})" if gaps and ctx.user_id else ""))
        if g["dependents"]:
            bits.append("Unlocks: " + ", ".join(d["name"] for d in g["dependents"][:3]))
        parts.append("Knowledge graph:\n" + "\n".join(bits))
    for name, st in list(ctx.collective.items())[:3]:
        if st["total_learners"] >= 2:
            parts.append(f"Platform data: {st['struggle_rate']}% of {st['total_learners']} learners find '{name}' hard.")
    if ctx.history:
        recent = ctx.history[-6:]
        parts.append("Recent conversation:\n" + "\n".join(f"{'Student' if m.get('role') == 'user' else 'Tutor'}: {str(m.get('content', ''))[:300]}" for m in recent))
    if source_block:
        parts.append("Sources:\n" + source_block)
    style = {"problem_solving": "Guide step by step.", "comparison": "Compare systematically.", "example_request": "Lead with a concrete example."}.get(ctx.intent, "")
    parts.append(f"Question ({ctx.intent}): {ctx.working_question}" + (f"\n{style}" if style else ""))
    return "\n\n".join(parts)


def _language_rule(lang: str) -> str:
    if lang == "en":
        return "Respond in English only."
    if lang == "hi":
        return "Write the answer in Hindi (Devanagari); keep code and formulas in English."
    if lang == "bilingual":
        return "Explain bilingually: Hindi (Devanagari) for explanation, English for code and formulas."
    return f"Respond in the language with code '{lang}'."


async def generate(ctx: Ctx) -> None:
    """7. Stream the answer. The study-aid call (steps, hints, follow-ups) runs concurrently on the fast model."""
    ai = get_ai_service()
    source_block = _number_sources(ctx)
    prompt = _build_prompt(ctx, source_block)
    ctx.emit and ctx.emit({"type": "meta", "concept": ctx.concept, "intent": ctx.intent, "difficulty": ctx.difficulty, "sources": ctx.sources, "graph": _graph_view(ctx)})

    system = TUTOR_SYSTEM + "\n\n" + _language_rule(ctx.language) + (f"\n\nSession instructions: {ctx.system_prompt}" if ctx.system_prompt else "")
    async for tok in ai.astream([{"role": "user", "content": prompt}], system=system):
        ctx.answer += tok
        ctx.emit and ctx.emit({"type": "token", "text": tok})
    if not ctx.answer.strip():
        raise RuntimeError("The model returned an empty answer")


async def verify(ctx: Ctx) -> None:
    """8. One fast call after the answer: fact-check it against the sources AND prepare study aids.
    Runs after the text is already on screen, so it never delays the answer. Also attaches the learner's trust tier."""
    evidence = "\n".join(ctx.evidence)[:3000]
    prompt = f"Question: {ctx.working_question}\nMain concept: {ctx.concept or 'unknown'}\n\nAnswer:\n{ctx.answer[:3500]}" + (
        f"\n\nSOURCES:\n{evidence}" if evidence else "\n\n(No sources were available; judge against general knowledge.)"
    )

    async def trust() -> Optional[str]:
        if not ctx.user_id:
            return None
        from app.services.ai_brain.trust_scorer import calculate_trust_score

        return str((await calculate_trust_score(ctx.user_id)).tier)

    check, tier = await asyncio.gather(get_ai_service().agenerate_json(prompt, REVIEW_SYSTEM, fast=True, max_tokens=900), trust(), return_exceptions=True)
    tier = tier if isinstance(tier, str) else None
    if not isinstance(check, dict) or not check.get("verdict"):
        # The check itself failed: say so rather than claim the answer was verified
        logger.warning("Verification did not run: %s", check if isinstance(check, BaseException) else "empty reply")
        ctx.verify = {"verdict": "UNVERIFIED", "confidence": None, "issues": [], "trust_tier": tier}
        return
    ctx.aux = check
    verdict = str(check["verdict"]).upper()
    ctx.verify = {
        "verdict": verdict if verdict in ("PASS", "REVIEW", "FLAG") else "REVIEW",
        "confidence": _clamp(check.get("confidence"), 0.8),
        "issues": [str(i)[:200] for i in (check.get("issues") or [])][:3],
        "trust_tier": tier,
    }


def _clamp(v: Any, default: float) -> float:
    try:
        return max(0.0, min(1.0, float(v)))
    except (TypeError, ValueError):
        return default


def _graph_view(ctx: Ctx) -> Optional[dict]:
    g = ctx.graph
    if not g:
        return None
    return {"concept": g["name"], "prerequisites": [p["name"] for p in g["prerequisites"][:6]], "unlocks": [d["name"] for d in g["dependents"][:4]], "related": [r["name"] for r in g["related"][:4]]}


STAGES: List[Stage] = [
    Stage("normalize", normalize, 3),
    Stage("understand", understand, 5, ("normalize",)),
    Stage("graph", graph, 4, ("understand",)),
    Stage("learner", learner, 3),
    Stage("documents", documents, 5, ("normalize",)),
    Stage("web", web, 3.5, ("normalize",)),
    Stage("generate", generate, 60, ("understand", "graph", "learner", "documents", "web")),
    Stage("verify", verify, 15, ("generate",)),
]


# ── runner ────────────────────────────────────────────────────────────────────────────────────

def _result(ctx: Ctx) -> Dict[str, Any]:
    v = ctx.verify
    aux = ctx.aux or {}
    graph_pre = [p["name"] for p in ctx.graph["prerequisites"]] if ctx.graph else []
    graph_rel = [r["name"] for r in ctx.graph["related"]] if ctx.graph else []
    confidence = v.get("confidence") if v.get("confidence") is not None else 0.7
    if v.get("verdict") == "FLAG":
        confidence *= 0.5
    mode = "agentic_rag" if ctx.doc_sources else "web_rag" if ctx.web_sources else "reasoning_engine"
    return {
        "answer": ctx.answer,
        "concept": ctx.concept,
        "prerequisites": (graph_pre or aux.get("prerequisites") or [])[:6],
        "stepwise_reasoning": aux.get("steps") or [],
        "hint_ladder": (aux.get("hints") or []) if ctx.include_hints and not (ctx.learner and ctx.learner["mastery"] > 0.7) else [],
        "confidence_score": round(confidence, 2),
        "related_concepts": (graph_rel or aux.get("related") or [])[:6],
        "follow_up_questions": (aux.get("follow_ups") or [])[:3],
        "misconceptions": aux.get("misconceptions") or [],
        "sources": ctx.sources,
        "mode": mode,
        "nli_verdict": v.get("verdict"),
        "nli_confidence": v.get("confidence"),
        "nli_flags": len(v.get("issues") or []),
        "nli_issues": v.get("issues") or [],
        "trust_tier": v.get("trust_tier"),
        "intent_detected": ctx.intent,
        "difficulty_level": ctx.difficulty,
        "language": ctx.language,
        "graph": _graph_view(ctx),
        "trace": ctx.trace,
    }


async def _grow_graph(ctx: Ctx) -> None:
    """After answering, teach the graph what was just discussed (fire and forget)."""
    try:
        from app.services import knowledge_graph_service as kg

        aux = ctx.aux or {}
        await kg.grow_graph(ctx.concept, aux.get("prerequisites") or [], aux.get("related") or [], ctx.domain)
    except Exception as exc:
        logger.debug("Graph growth skipped: %s", exc)


async def run(
    question: str,
    user_id: Optional[str] = None,
    language: str = "en",
    collection: str = "default",
    history: Optional[List[Dict[str, Any]]] = None,
    system_prompt: Optional[str] = None,
    include_hints: bool = True,
) -> AsyncIterator[dict]:
    """Run all stages as a dependency graph and yield events as they happen."""
    queue: asyncio.Queue = asyncio.Queue()
    ctx = Ctx(
        question=question, user_id=user_id, language=language or "en", collection=collection or "default",
        history=history or [], system_prompt=system_prompt, include_hints=include_hints, emit=queue.put_nowait,
    )
    t_start = time.perf_counter()
    tasks: Dict[str, asyncio.Task] = {}

    async def run_stage(stage: Stage) -> None:
        for d in stage.deps:
            await tasks[d]  # run_stage never raises, so waiting is always safe
        t0 = time.perf_counter()
        queue.put_nowait({"type": "stage", "name": stage.name, "status": "start"})
        status = "done"
        try:
            await asyncio.wait_for(stage.fn(ctx), timeout=stage.timeout)
        except asyncio.TimeoutError:
            status = "timeout"
        except AINotConfigured as exc:
            status, ctx.errors[stage.name] = "error", exc
        except Exception as exc:
            status, ctx.errors[stage.name] = "error", exc
            logger.warning("Stage %s failed: %s", stage.name, exc)
        ms = round((time.perf_counter() - t0) * 1000)
        ctx.trace.append({"stage": stage.name, "status": status, "ms": ms, "at_ms": round((time.perf_counter() - t_start) * 1000)})
        queue.put_nowait({"type": "stage", "name": stage.name, "status": status, "ms": ms})

    async def driver() -> None:
        for st in STAGES:  # creation order == dependency order; tasks then run concurrently
            tasks[st.name] = asyncio.create_task(run_stage(st))
        await asyncio.gather(*tasks.values())
        queue.put_nowait(None)

    main = asyncio.create_task(driver())
    try:
        # The answer is complete before verify finishes; stream tokens immediately, final after verify.
        while True:
            ev = await queue.get()
            if ev is None:
                break
            yield ev
        gen_err = ctx.errors.get("generate")
        if gen_err or not ctx.answer.strip():
            err = gen_err or RuntimeError("No answer was produced")
            code = "not_configured" if isinstance(err, AINotConfigured) else "generation_failed"
            yield {"type": "error", "message": str(err), "code": code}
            return
        ctx.trace.append({"stage": "total", "status": "done", "ms": round((time.perf_counter() - t_start) * 1000)})
        asyncio.create_task(_grow_graph(ctx))
        yield {"type": "final", "result": _result(ctx)}
    finally:
        if not main.done():
            main.cancel()


async def run_to_completion(**kwargs) -> Dict[str, Any]:
    """Non-streaming convenience: returns the final result dict or raises."""
    async for ev in run(**kwargs):
        if ev["type"] == "final":
            return ev["result"]
        if ev["type"] == "error":
            if ev.get("code") == "not_configured":
                raise AINotConfigured(ev["message"])
            raise RuntimeError(ev["message"])
    raise RuntimeError("Pipeline ended without a result")
