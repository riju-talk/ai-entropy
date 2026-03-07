# Entropy — Adaptive Learning Infrastructure

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=FastAPI&logoColor=white)](https://fastapi.tiangolo.com/)
[![AWS Bedrock](https://img.shields.io/badge/Amazon_Bedrock-FF9900?style=for-the-badge&logo=amazonaws&logoColor=white)](https://aws.amazon.com/bedrock/)
[![Neo4j](https://img.shields.io/badge/Neo4j-008CC1?style=for-the-badge&logo=neo4j&logoColor=white)](https://neo4j.com/)
[![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white)](https://prisma.io/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Python](https://img.shields.io/badge/Python_3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org/)
[![AWS Lambda](https://img.shields.io/badge/AWS_Lambda-FF9900?style=for-the-badge&logo=awslambda&logoColor=white)](https://aws.amazon.com/lambda/)
[![Status](https://img.shields.io/badge/Status-Production_Ready-success?style=for-the-badge)](docs/FINAL_IMPLEMENTATION_STATUS.md)

> **Not a chatbot. Not RAG. Not an LMS.**  
> **Entropy is learning infrastructure.**

**📚 [Architecture](DESIGN.md) • 🚀 [Deployment Guide](docs/DEPLOYMENT_GUIDE.md) • ⚡ [Quick Start](quick-start.ps1)**

A knowledge-graph-driven, rubric-aware, mastery-tracking AI platform powered by **Amazon Bedrock (Claude 3 Sonnet)**, with a custom 8-layer AI brain, community Q&A, real-time gamification, and a fully serverless AWS backend.

---

## What Makes Entropy Different

| Generic AI Tutors | Entropy |
|---|---|
| Pull from flat vector index | **Reason over a structured Neo4j knowledge graph** |
| One-size-fits-all answers | **Mastery-aware responses that adapt per user** |
| Opaque grading | **Rubric-aware evaluation with explainable scores** |
| Single-domain | **Universal: 200+ concepts, 25+ disciplines** |
| Synchronous, blocking calls | **Parallel Lambda fan-out + async SQS workers** |
| No community layer | **Community Q&A, voting, reputation, moderation** |

---

## Key Features

### 8-Layer AI Brain (Entropy Engine)
The core intelligence pipeline runs every query through:

1. **Intent Classification** — QA / code / document / recommendation
2. **Query Rewriting** — synonym expansion, concept alias resolution
3. **Parallel Retrieval Fan-out** — RAG worker + Tavily web-search worker invoked concurrently via Lambda
4. **Knowledge Graph Context** — Neo4j prerequisite traversal and concept neighbourhood
5. **Context Reranking** — cross-encoder selects the most relevant chunks
6. **Prompt Composition** — instruction + user mastery state + retrieved evidence
7. **LLM Generation** — Amazon Bedrock Claude 3 Sonnet with structured JSON output
8. **Post-processing** — citation stitching, safety filter, multilingual translation

### Knowledge Graph (Neo4j)
- 200+ concepts across 25+ disciplines with typed `PREREQUISITE_OF` / `RELATED_TO` / `EXPLAINS` edges
- Prerequisite traversal surfaces what a user needs to learn *before* a target concept
- Weak-node detection triggers automatic review recommendations

### Mastery-Aware Adaptive Learning
```
mastery = (correct_attempts / total_attempts) × confidence_weight
```
- Confidence weight decays with hint overuse (−0.1/hint) and inactivity (−0.02/day after 7 days)
- Every interaction writes an XP ledger entry and updates the Neo4j `MASTERED_BY` edge

### Rubric-Based Evaluation
Multi-dimensional grading (correctness, reasoning, clarity, depth) with weighted arithmetic computed in Python — never trusted to the LLM. Structured Pydantic output with enforced JSON schema.

### Gamification Engine
- XP + level progression (Freshman → Sage), Entropy Coins, daily/weekly streaks
- Achievements with deduplication and race-condition-safe unlock
- Leaderboards (XP and reputation) backed by Prisma + PostgreSQL

### Community Platform
- Subject-specific communities, rich Q&A (LaTeX, code blocks), threaded comments
- Trust scoring, anti-abuse IP clustering and similarity detection, vote-based reputation
- Moderation roles, mentorship programs

### Async Serverless Architecture
- `POST /api/qa` returns to the client immediately; mastery and gamification events are dispatched to **Amazon SQS** and consumed by dedicated Lambda workers
- RAG retrieval and Tavily web search run **concurrently** via parallel Lambda invocations, halving latency on grounded answers
- Dead-letter queues on every SQS queue; CloudWatch for observability

### Multilingual Support
- `langdetect` auto-detects input; `deep-translator` handles 100+ languages
- All reasoning runs in English internally; response is translated back before delivery

---

## Architecture

```
┌──────────────────────────────────────────┐
│  Frontend  (Next.js 14 · Amplify/CF)     │
│  Auth: NextAuth · GitHub · Google OAuth  │
└───────────────────┬──────────────────────┘
                    │ HTTPS
┌───────────────────▼──────────────────────┐
│  API Gateway HTTP API                    │
│  → Lambda: entropy-ai-engine (Mangum)    │
│    FastAPI app  ·  Python 3.11           │
├──────────────────────────────────────────┤
│  Parallel fan-out (IS_LAMBDA=true)       │
│  ├─ Lambda: rag_worker    (Bedrock+Pinecone) │
│  └─ Lambda: tavily_worker (Tavily web)  │
├──────────────────────────────────────────┤
│  Async SQS consumers                     │
│  ├─ Lambda: mastery_worker              │
│  └─ Lambda: gamification_worker         │
└──────────┬───────────┬───────────────────┘
           │           │
  ┌────────▼─┐   ┌─────▼──────────────────┐
  │ Neo4j    │   │ RDS PostgreSQL (Prisma) │
  │ (graph)  │   │ Redis (cache/sessions)  │
  └──────────┘   │ S3 (documents)          │
                 │ Pinecone (vectors)      │
                 └─────────────────────────┘
```

**Detailed design:** [DESIGN.md](DESIGN.md) · [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/AI_BRAIN_ARCHITECTURE.md](docs/AI_BRAIN_ARCHITECTURE.md)

---

## Project Structure

```
ai-entropy/
├── apps/
│   ├── app/                        # Next.js 14 App Router (frontend, port 5000)
│   │   ├── app/                    # Route segments (dashboard, communities, q&a, profile …)
│   │   ├── components/             # Shared React components
│   │   ├── prisma/schema.prisma    # PostgreSQL schema (community + gamification models)
│   │   └── lib/                    # Server actions, API helpers
│   └── ai-agent/                   # FastAPI AI Engine (backend, port 8000)
│       ├── app/
│       │   ├── api/routes/         # HTTP route handlers
│       │   │   ├── qa.py           # Q&A + SQS fan-out
│       │   │   ├── gamification.py # XP, achievements, leaderboards
│       │   │   ├── mastery.py      # Mastery tracking
│       │   │   ├── reasoning.py    # Structured reasoning
│       │   │   ├── documents.py    # Document upload + ingestion
│       │   │   ├── graph.py        # Knowledge graph CRUD
│       │   │   ├── quiz.py         # Quiz generation
│       │   │   ├── mindmap.py      # Mindmap generation
│       │   │   └── evaluation.py   # Rubric evaluation
│       │   ├── services/
│       │   │   ├── agentic_rag_service.py   # Parallel RAG orchestrator
│       │   │   ├── bedrock_service.py        # Bedrock Claude + Titan Embeddings
│       │   │   ├── knowledge_graph_service.py
│       │   │   ├── mastery_service.py
│       │   │   ├── gamification/             # XP engine, achievements, streaks
│       │   │   ├── ai_brain/                 # 8-layer cognitive pipeline
│       │   │   ├── anti_abuse/               # Trust scoring, abuse detection
│       │   │   └── tavily_service.py         # Web search via Tavily
│       │   ├── workers/                      # Lambda SQS-triggered handlers
│       │   │   ├── rag_worker.py
│       │   │   ├── tavily_worker.py
│       │   │   ├── mastery_worker.py
│       │   │   └── gamification_worker.py
│       │   └── config.py                    # Pydantic settings (AWS, Neo4j, Redis …)
│       ├── serverless.yml                   # Serverless Framework deployment
│       └── lambda_handler.py                # Mangum entrypoint
├── infrastructure/
│   ├── cdk/                        # AWS CDK stack (Lambdas, SQS, API Gateway)
│   └── iam/                        # IAM policy documents
├── packages/
│   ├── ui/                         # Shared component library
│   ├── eslint-config/
│   └── typescript-config/
└── docs/                           # Full engineering documentation
```

---
## Engineering Documentation Index

- [AI Brain Architecture](docs/AI_BRAIN_ARCHITECTURE.md)
- [AI Brain Implementation Complete](docs/AI_BRAIN_IMPLEMENTATION_COMPLETE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Component Responsiveness Checklist](docs/COMPONENT_RESPONSIVENESS_CHECKLIST.md)
- [Demo Guide](docs/DEMO_GUIDE.md)
- [Demo Summary](docs/DEMO_SUMMARY.md)
- [Deployment Guide](docs/DEPLOYMENT_GUIDE.md)
- [Final Implementation Status](docs/FINAL_IMPLEMENTATION_STATUS.md)
- [Game Engine Architecture](docs/GAME_ENGINE_ARCHITECTURE.md)
- [Gamification](docs/GAMIFICATION.md)
- [Implementation Status](docs/IMPLEMENTATION_STATUS.md)
- [NLI Architecture](docs/NLI_ARCHITECTURE.md)
- [Phase 1 Complete](docs/PHASE1_COMPLETE.md)
- [Phase 6 Complete](docs/PHASE6_COMPLETE.md)
- [README Complete](docs/README_COMPLETE.md)
- [Responsive Improvements Summary](docs/RESPONSIVE_IMPROVEMENTS_SUMMARY.md)
- [Schema Migration Plan](docs/SCHEMA_MIGRATION_PLAN.md)
- [Session Completion Summary](docs/SESSION_COMPLETION_SUMMARY.md)
- [System Architecture](docs/SYSTEM_ARCHITECTURE.md)
- [Technical Summary Engineering](docs/TECHNICAL_SUMMARY_ENGINEERING.md)
- [Technical Summary Project Management](docs/TECHNICAL_SUMMARY_PROJECT_MANAGEMENT.md)
- [Testing Comprehensive](docs/TESTING_COMPREHENSIVE.md)
- [Testing Guide](docs/TESTING_GUIDE.md)
- [Trust and Abuse Model](docs/TRUST_AND_ABUSE_MODEL.md)
- [Work Completion Summary](docs/WORK_COMPLETION_SUMMARY.md)
- [Summary](docs/summary.md)
---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14 (App Router) · TypeScript · TailwindCSS · Radix UI · shadcn/ui |
| **Backend** | FastAPI · Python 3.11 · Pydantic v2 · Mangum (Lambda adapter) |
| **LLM** | Amazon Bedrock — Claude 3 Sonnet (`anthropic.claude-3-sonnet-20240229-v1:0`) |
| **Embeddings** | Amazon Bedrock — Titan Embeddings V2 (`amazon.titan-embed-text-v2:0`) |
| **Vector Store** | Pinecone (production) · Chroma (local dev) |
| **Knowledge Graph** | Neo4j 5.x (Bolt) via `neo4j` Python driver |
| **Relational DB** | PostgreSQL via Prisma ORM (Next.js side) + Prisma Python client (AI side) |
| **Cache / Queue** | Amazon ElastiCache Redis · Amazon SQS (mastery + gamification workers) |
| **Object Storage** | Amazon S3 (document upload + processed text) |
| **Auth** | NextAuth.js — GitHub OAuth · Google OAuth |
| **Infra** | Serverless Framework v3 · AWS CDK v2 · AWS Lambda · API Gateway HTTP API |
| **Web Search** | Tavily AI (`tavily-python`) |
| **Translation** | `deep-translator` + `langdetect` (100+ languages) |
| **Observability** | AWS CloudWatch · X-Ray · SQS DLQs |
| **Monorepo** | Turborepo + pnpm workspaces |

---

## Getting Started

### Prerequisites

- Node.js 20+ and pnpm
- Python 3.11+
- Docker (for Neo4j and Redis in local dev)
- AWS account with Bedrock access (Claude 3 Sonnet + Titan Embeddings enabled in `ap-northeast-1`)

### 1. Clone and configure

```bash
git clone https://github.com/your-org/ai-entropy.git
cd ai-entropy
cp .env.example .env
# Fill in: AWS credentials, DATABASE_URL, NEO4J_*, REDIS_*, NEXTAUTH_SECRET
```

### 2. Install dependencies

```bash
pnpm install              # frontend + shared packages
cd apps/ai-agent
python -m venv .venv
.venv\Scripts\activate    # Windows  |  source .venv/bin/activate  (Linux/Mac)
pip install -r requirements.txt
```

### 3. Start backing services (Docker)

```bash
docker-compose up -d      # starts Neo4j + Redis
```

### 4. Run database migration

```bash
cd apps/app
pnpm db:push              # pushes schema to PostgreSQL
pnpm db:generate          # generates Prisma client
```

### 5. Start dev servers

```bash
# Terminal 1 — Next.js frontend
cd apps/app
pnpm dev                  # http://localhost:5000

# Terminal 2 — FastAPI backend
cd apps/ai-agent
uvicorn app.main:app --reload --port 8000
# Swagger UI: http://localhost:8000/docs
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5000 |
| AI Engine API | http://localhost:8000 |
| Swagger UI | http://localhost:8000/docs |
| Neo4j Browser | http://localhost:7474 |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `AWS_ACCESS_KEY_ID` | Yes | AWS credentials for Bedrock + S3 + SQS |
| `AWS_SECRET_ACCESS_KEY` | Yes | |
| `AWS_REGION` | Yes | Default: `ap-northeast-1` |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `DIRECT_URL` | Yes | PostgreSQL direct URL (for Prisma migrations) |
| `NEO4J_URI` | Yes | Bolt URI, e.g. `bolt://localhost:7687` |
| `NEO4J_PASSWORD` | Yes | Neo4j password |
| `REDIS_HOST` | Yes | Redis host |
| `NEXTAUTH_SECRET` | Yes | NextAuth signing secret |
| `AI_BACKEND_TOKEN` | Yes | Shared secret: Next.js → AI Engine |
| `NEXT_PUBLIC_AI_BACKEND_URL` | Yes | AI Engine URL visible from the browser |
| `TAVILY_API_KEY` | Yes | Tavily web search key |
| `PINECONE_API_KEY` | Prod | Pinecone vector DB key |
| `IS_LAMBDA` | Lambda | Set `true` in Lambda env to enable SQS fan-out |
| `MASTERY_QUEUE_URL` | Lambda | SQS URL for async mastery events |
| `GAMIFICATION_QUEUE_URL` | Lambda | SQS URL for async gamification events |

---

## AWS Deployment

The backend deploys to AWS Lambda via **Serverless Framework**:

```bash
cd apps/ai-agent
# Set SSM parameters first (DATABASE_URL, NEO4J_*, REDIS_*, secrets)
npx serverless deploy --stage prod
```

This provisions:
- `entropy-ai-engine-prod` — main FastAPI Lambda (Mangum)
- `entropy-ai-engine-prod-rag_worker` — parallel RAG retrieval
- `entropy-ai-engine-prod-tavily_worker` — parallel web search
- `entropy-ai-engine-prod-mastery_worker` — SQS consumer for mastery events
- `entropy-ai-engine-prod-gamification_worker` — SQS consumer for gamification events
- SQS queues (`entropy-mastery-queue`, `entropy-gamification-queue`) with DLQs

Optional CDK deployment (`infrastructure/cdk`):

```bash
cd infrastructure/cdk
npm install
npx cdk deploy --context stage=prod
```

See [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) for full AWS setup including Amplify frontend, RDS, ElastiCache, and SSM parameter configuration.

---

## API Reference

### AI Engine — `http://localhost:8000`

| Method | Path | Description |
|---|---|---|
| `GET`  | `/health` | Health check + service status |
| `GET`  | `/docs` | Interactive Swagger UI |
| `POST` | `/api/qa` | Ask a question (Agentic RAG + knowledge graph) |
| `POST` | `/api/reasoning/ask` | Structured step-by-step reasoning |
| `POST` | `/api/evaluation/evaluate` | Rubric-based evaluation |
| `POST` | `/api/mastery/attempt` | Record an attempt, update mastery |
| `GET`  | `/api/mastery/profile/{user_id}` | Full mastery profile |
| `POST` | `/api/documents` | Upload and ingest a document |
| `POST` | `/api/quiz` | Generate a quiz |
| `POST` | `/api/mindmap` | Generate a mindmap |
| `POST` | `/api/graph/concept` | Add a concept node |
| `POST` | `/api/graph/prerequisite` | Link a prerequisite |
| `GET`  | `/api/graph/context/{concept}` | Concept context + neighbours |
| `GET`  | `/api/graph/weak/{user_id}` | User's weak concept nodes |
| `GET`  | `/api/graph/path/{user_id}/{concept}` | Recommended learning path |
| `POST` | `/api/gamification/event` | Fire a gamification event (XP, achievements) |
| `GET`  | `/api/gamification/leaderboard/xp` | XP leaderboard |
| `GET`  | `/api/gamification/leaderboard/reputation` | Reputation leaderboard |

---

## Documentation Index

| Document | Description |
|---|---|
| [DESIGN.md](DESIGN.md) | Full system design — architecture, AI pipeline, data models |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | High-level component architecture |
| [docs/AI_BRAIN_ARCHITECTURE.md](docs/AI_BRAIN_ARCHITECTURE.md) | 8-layer cognitive pipeline detail |
| [docs/GAME_ENGINE_ARCHITECTURE.md](docs/GAME_ENGINE_ARCHITECTURE.md) | XP / gamification engine design |
| [docs/GAMIFICATION.md](docs/GAMIFICATION.md) | Gamification rules and level progression |
| [docs/TRUST_AND_ABUSE_MODEL.md](docs/TRUST_AND_ABUSE_MODEL.md) | Trust scoring and anti-abuse system |
| [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) | AWS deployment walkthrough |
| [docs/TESTING_GUIDE.md](docs/TESTING_GUIDE.md) | Test strategy and running tests |
| [docs/DEMO_GUIDE.md](docs/DEMO_GUIDE.md) | Demo walkthrough for evaluators |

---

## Contributing

Pull requests are welcome. For major changes, open an issue first to discuss the approach.

---

## License

MIT