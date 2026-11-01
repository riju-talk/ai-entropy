# Entropy AI service

FastAPI service behind the Next.js app. It does retrieval-augmented answers (Pinecone + Tavily), quizzes,
flashcards, mind maps, mastery tracking, the concept graph (Neo4j) and gamification. LLM calls go to Groq
through LangChain; embeddings run locally with fastembed (`BAAI/bge-small-en-v1.5`, 384 dimensions).

Only the Next.js server calls this service. Every `/api` route requires the `X-Internal-Token` header
(`AI_BACKEND_TOKEN`); `/health` is public. See [DEPLOYMENT.md](../../DEPLOYMENT.md) for hosting.

## Run locally

```bash
cd apps/ai-agent
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                   # fill GROQ_API_KEY, AI_BACKEND_TOKEN, DATABASE_URL ...
prisma generate                                        # Python client from prisma/schema.prisma
uvicorn app.main:app --reload --port 8000
```

Set `DEBUG=true` to call the API without a token while developing. Python 3.12 is the supported version.

## Layout

| Path | Purpose |
|---|---|
| `app/main.py` | App factory, route mounting, lifespan (DB, cache, message bus) |
| `app/core/` | `config.py` (the only settings class), `security.py` (service-token auth), `llm.py`, `cache.py`, `database.py` |
| `app/services/ai_service.py` | Groq chat + local embeddings behind one interface |
| `app/services/storage_service.py` | Supabase Storage for uploaded documents |
| `app/bus/` | In-process message queues (retry, dead-letter, outbox replay) |
| `app/api/routes/` | `qa`, `documents`, `quiz`, `flashcards`, `mindmap`, `mastery`, `graph`, `gamification`, `reasoning`, `evaluation` |
| `prisma/schema.prisma` | **Generated** from `apps/app/prisma/schema.prisma` with `npm run db:sync`; do not edit by hand |

## Tests

```bash
pip install pytest
pytest tests
```

The tests need no network or API keys (the LLM call is stubbed).
