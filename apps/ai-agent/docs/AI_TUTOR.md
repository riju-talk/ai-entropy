# AI Tutor: architecture, harness, graph, NLI, guardrails, deployment

This is the reference for the tutoring path: `POST /api/qa/stream` (and the one-shot `POST /api/qa/`).
Code lives in `apps/ai-agent/app/`; the browser side is `apps/app/lib/stream-qa.ts` and
`apps/app/components/ai-agent/{chat-agent,agent-timeline}.tsx`.

## 1. Why it returned HTTP 503 (root cause)

`503` is raised in exactly one place: `AINotConfigured` (`services/ai_service.py`) when `GROQ_API_KEY` is empty,
mapped to HTTP 503 by `main.py`. The Next.js proxy (`/api/ai-agent/qa/stream`) adds a second source of 503:
if the AI service URL (`BACKEND_URL`) is unreachable it answers "not reachable".
On the live site the AI service was **never deployed** (no Render service, `BACKEND_URL` unset), so every request
hit the second case. Fixing the Python code cannot fix that: the service has to be deployed with a key (section 9).

Code-level problems found and fixed on the way:

| Problem | Fix |
|---|---|
| Replies could stop at the token limit and be shown as complete | Continuation-aware streaming, section 3 |
| No way to tell a finished stream from a cut-off one | Explicit `done` event; the client rejects streams without it |
| Rate limiter had no cap on open streams or on total LLM traffic, used `BaseHTTPMiddleware` (poor fit for SSE disconnects), and fell back to the proxy's address for anonymous callers | Rewritten, section 7 |
| Tokens were only rendered after the whole answer arrived (typing dots until the end) | Live Markdown rendering, batched |
| Client-supplied `system_prompt` and history were trusted | Sanitised and fenced, section 6 |
| "Verified" answers with no sources could show PASS | NLI rules, section 5 |
| Fast-model first call took ~7 s (lazy import) | Warm-up at startup |

## 2. Architecture

```
Browser ──fetch(SSE)──► Next.js /api/ai-agent/qa/stream ──(X-Internal-Token, X-User-Id)──► FastAPI /api/qa/stream
   ▲  chat-agent.tsx          verifies session, loads history,                        rate limit ► harness.run()
   │  agent-timeline.tsx      persists the exchange on `final`                                        │
   └──────────── stage | tool | meta | token | continuation | final | error | done ◄─────────────────┘
                                                                                      Groq (qwen/qwen3.8-27b, gpt-oss-20b)
```

Key decisions:

* **The browser never talks to the AI service.** Only the Next.js server does, with a shared secret and the
  *verified* session user id. The AI service never trusts a user id from the body.
* **A dependency graph of stages, not a list** (`services/harness.py`): independent stages (graph, documents,
  web, tools) run in parallel; a slow or broken one times out and the answer is produced without it.
* **Every stage reports a one-line, student-safe summary.** The UI shows those, never raw model reasoning.

## 3. Groq integration (`services/ai_service.py`)

* Official stack: `langchain-groq` over the Groq SDK. Key from `GROQ_API_KEY` (environment only).
* Models: `GROQ_MODEL` (default `qwen/qwen3.8-27b`, answers) and `GROQ_FAST_MODEL` (`openai/gpt-oss-20b`,
  intent / NLI judge / study aids). Both configurable. Parameters match the snippet you gave:
  `temperature 0.6`, `top_p 0.95`, `max_completion_tokens 2048`, `reasoning_effort default`, `stream=True`.
* Retries (`LLM_MAX_RETRIES`), timeout (`LLM_TIMEOUT_SECONDS`), a fast model that fails fast (1 retry).
* Async end to end (`astream`, no thread hop); the Groq stream is closed in a `finally`, so a client disconnect
  stops token spend.
* **No silent clipping.** `astream_complete` watches `finish_reason`. On `length` it asks the model to continue
  (up to `LLM_MAX_CONTINUATIONS`), after cutting back to the last *whole word*: a limit usually lands mid-word
  (`...12, 1` for 13), and continuing from a half word produced garbled splices against the real API. If the cap
  is hit too, `completion.truncated` is set and the UI shows a banner with a **Continue** button.
* Context budget: `LLM_CONTEXT_CHAR_BUDGET` caps the prompt; oldest history is dropped first, then sources, never
  the question.

Limitation: the model sometimes ends a continuation early on its own (reports `stop`). That is indistinguishable
from a normal finish, so it cannot be repaired; the Continue button is the recovery.

## 4. Harness (`services/harness.py`)

| # | Stage (timeline label) | What it does |
|---|---|---|
| 1 | `guard` — Checking the question | Ingestion + input guardrails, before any model call |
| 2 | `history` — Searching conversation context | Keeps only safe user/assistant turns |
| 3 | `understand` — Understanding the question | One fast-model JSON call: intent, concepts, difficulty |
| 4 | `graph` — Retrieving knowledge graph information | Neo4j, else the local graph (section 8) |
| 5 | `documents`, `web`, `tools` — tool calls | Retrieval + calculator + allowlisted MCP tools |
| 6 | context construction | `_build_prompt`: fenced data, budgeted |
| 7 | `generate` — Generating the response | Groq stream, secret redaction, continuation |
| 8 | `verify` — Validating the response | NLI + citation check + study aids |
| 9 | `complete` — Completing the answer | `final` then `done` |

SSE contract (`api/routes/qa.py`):

```
event: stage         {name, status: start|done|timeout|error, ms, detail}
event: tool          {id, name, kind: builtin|mcp, status: running|ok|error|timeout, ms, summary, origin}
event: meta          {concept, intent, sources, graph}
event: token         {text}
event: continuation  {n}
event: final         {answer, nli, answer_note, completion, tools, guardrails, steps, ...}
event: error         {message, code}          (no final follows)
event: done          {ok}                      ALWAYS last
: ping                                         heartbeat every 10 s (keeps proxies from closing an idle-looking stream)
```

Tools (`services/tools.py`): `calculator` (AST evaluator, never `eval`), `search_documents`, `web_search`, and MCP.
MCP client speaks streamable HTTP JSON-RPC (`initialize`, `tools/list`, `tools/call`; JSON or SSE replies).
**Permission boundary:** only registered tools run; MCP tools only if named in `MCP_TOOL_ALLOWLIST` (default none);
read-only; max 3 calls per question; per-tool timeout; arguments limited to the declared schema and size-capped;
tools never receive the user id or secrets; results are scrubbed and truncated before the model or UI sees them.
Tested against a mocked MCP server only; point `MCP_SERVER_URLS` at a real one and exercise it before relying on it.

## 5. NLI validation (`services/nli.py`)

A judge model reads **only the retrieved evidence** (documents, web, tool results) and labels each claim
`ENTAILMENT`, `CONTRADICTION` or `NEUTRAL`, plus an answer-relevance score. Verdict logic is plain Python
(`decide`), thresholds in settings:

* supported = ENTAILMENT with confidence ≥ `NLI_ENTAIL_THRESHOLD` (0.6)
* contradicted = CONTRADICTION with confidence ≥ `NLI_CONTRADICT_THRESHOLD` (0.5) → verdict `CONTRADICTED`
* **neutral is not proof**: neutral and low-confidence claims count as unsupported
* supported ratio ≥ `NLI_MIN_SUPPORTED_RATIO` → `SUPPORTED` (with a note if some claims go beyond the sources), else `PARTIAL`
* **no evidence → `UNGROUNDED`** (never PASS); a judge failure → `UNVERIFIED`
* relevance < 0.4 adds an issue

The UI shows one badge ("Backed by your sources (80% of claims)", "General knowledge — not checked against
sources", ...). Limits: the judge is an LLM, not a trained NLI classifier, so labels are probabilistic; it sees at
most 8 claims and ~3.5k characters of evidence; claim extraction is heuristic (sentence-based).

## 6. Guardrails (`services/guardrails.py`)

| Concern | Mechanism |
|---|---|
| Input validation | trim, strip control/zero-width chars, empty and length (`INPUT_MAX_CHARS`) checks |
| Prompt injection | clear extraction attempts (system prompt, keys) are **refused with no model call**; milder "ignore your instructions" phrasing is flagged and the question is fenced as data. Legitimate questions *about* security pass |
| Context isolation | history keeps only `user`/`assistant` turns (`system`/`tool` dropped), capped; client `system_prompt` is sanitised and demoted to a style preference; question, history, sources and tool output are fenced as data and the system prompt says never to obey them |
| Retrieved text | instruction-like lines are stripped from documents, web results and tool output |
| Secret redaction | in the live stream, with a holdback buffer so a key split across tokens is still caught; also on tool output |
| Prompt leakage | a random canary in the system prompt; if it appears in output it is redacted and flagged |
| Citation / provenance | every `[n]` must be a real numbered source; invalid ones are flagged and removed from the final text |
| Hallucination | NLI (section 5), `UNGROUNDED` labelling |
| Tool boundary | section 4 |
| Safe failure | each stage has a timeout and a safe default; errors never leak internals (`kaboom` is not echoed) |
| Graph poisoning | questions flagged as injection do not write to the shared graph |

These are heuristics. They raise the cost of an attack; they are not a guarantee. The hard limits are structural:
the model has no write tools, secrets are never in its prompt, and output is redacted.

## 7. Rate limiting (`middleware/rate_limit.py`)

Hand-written, in-process, pure ASGI (so a disconnect during a stream reliably frees its slot).

* **Sliding-window log** per caller with several windows per rule (tutor: 12/min **and** 120/hour). No boundary burst.
  Stored timestamps are capped at the largest limit; idle keys are garbage-collected.
* **Concurrency cap:** 2 open answer streams per user; the slot is released on completion, error, disconnect and cancellation.
* **Global cap:** 90/min across all LLM routes so one crowd cannot burn the Groq quota.
* **Identity:** the user id from `X-User-Id` *only when* `X-Internal-Token` is valid; otherwise the right-most
  `X-Forwarded-For` entry (added by our proxy; the left-most is forgeable), else the socket peer.
* Responses: `429` with `Retry-After`, JSON `{code: rate_limited | service_busy | too_many_streams}`,
  `X-RateLimit-Limit/Remaining` on success. `/health` and CORS preflights are never limited.
* Ordered inside CORS so 429s still carry CORS headers.

Limitation: counters are per process. With N instances the limits are N× looser; use Redis if you scale out.
The web app should also limit per session at the Next.js layer if it is exposed beyond trusted users.

## 8. Knowledge graph

Primary store: Neo4j (`services/knowledge_graph_service.py`), used when `NEO4J_PASSWORD` is set and reachable
(with a 60 s circuit breaker, so an outage costs one 2.5 s timeout per minute, not per question).
**Fallback: `services/graph_local.py`**, seeded from the curated concept map (`concept_seeder.CONCEPTS`, 200+ concepts),
so the tutor gets graph context even with no Neo4j (the current production setup).

| Checklist item | Implementation |
|---|---|
| Entity extraction | `understand` stage names 1–3 concepts; `review` proposes prerequisites/related for growth |
| Normalisation | lower-case, punctuation/stop-word strip, plural folding, alias table (`ml`, `bst`, `dp`...) |
| Deduplication | one node per normalised key; spellings kept as aliases; edges merge sources |
| Relationships | `PREREQUISITE_OF` (cycle-checked, never self-linked) and `RELATED_TO` |
| Persistence | Neo4j (durable). Local graph is per process and resets on restart |
| Traversal | transitive prerequisites to depth 2, ordered foundational → advanced; direct unlocks |
| Semantic retrieval | lexical (token containment + trigram cosine). **Not embeddings**: catches name variants, not paraphrases |
| Context ranking | curated (`seed`) edges outrank single model guesses; then closeness in difficulty |
| Provenance | each edge keeps its sources (`seed`, `answer`); returned as `provenance` and the answering store (`neo4j`/`local`) is named in the timeline |

## 9. Deployment

1. **Render:** New → Blueprint → `apps/ai-agent/render.yaml` (three services share one image; `SERVICE_ROLE=tutor`
   is enough for the tutor). Set secrets in the dashboard: `GROQ_API_KEY`, `AI_BACKEND_TOKEN`, `ALLOWED_ORIGINS`.
   Optional: `DATABASE_URL`/`DIRECT_URL` (document search + mastery), `NEO4J_*`, `TAVILY_API_KEY`, `PINECONE_API_KEY`.
2. **Vercel** (`entropy-app`): set `BACKEND_URL` (or `AI_TUTOR_URL`) to the Render URL and `AI_BACKEND_TOKEN` to the **same**
   value as Render; redeploy.
3. Health: `GET <render-url>/health` must report `llm_model: qwen/qwen3.8-27b`. `degraded` just means Neo4j/Postgres are not configured.
4. **Timeouts / buffering:** heartbeats every 10 s; response headers disable proxy buffering
   (`X-Accel-Buffering: no`, `Cache-Control: no-transform`); the Next route sets `maxDuration = 60`. Render's free
   plan sleeps after inactivity, so the first request after a pause is slow (a cold start of ~30–60 s) and may exceed the
   60 s function limit; use a paid instance or a keep-alive ping if that matters.
5. Rotate any key that has been pasted into chat or a ticket.

## 10. Tests

Offline (no network, ~7 s): `cd apps/ai-agent && python -m pytest tests -q`

| File | Covers |
|---|---|
| `test_guardrails.py` | input validation, injection, context isolation, redaction (incl. split keys), canary, citations |
| `test_rate_limit.py` | sliding window, multi-window, GC, bounded memory, 429s, headers, per-user vs forged identity, global cap, stream cap, slot release on error and on disconnect |
| `test_nli_tools_graph.py` | NLI verdicts and thresholds, claim extraction, calculator safety, tool boundary, MCP over a mocked server (JSON + SSE, allowlist, outage), graph normalisation/cycles/ranking/provenance |
| `test_streaming.py` | continuation without duplication, mid-word cuts, truncation cap, 5,000-word stream, upstream close on abandon, harness events/order, tool events, fencing, refusal, redaction, citations, helper-model failure, pipeline cancellation, SSE route (`done`, error+done, 429, auth) |
| `test_harness.py`, `test_api.py`, `test_bus.py` | existing suites, updated |

Live Groq (opt in, ~15 s, a few hundred tokens): `RUN_LIVE_GROQ=1 GROQ_API_KEY=... python -m pytest tests/test_groq_live.py -q`
covers model availability, real streaming, forced continuation across a tiny token limit, and fast-model JSON.
The live tests found a real defect (garbled splice at a mid-word cut) that the mocked tests had not.

Not covered by automated tests: the React timeline/stop/continue UI (verified by type-check only, not exercised in a
browser), a real MCP server, Neo4j, and Render's proxy behaviour.
