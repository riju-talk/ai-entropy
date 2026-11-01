# Entropy: a self-learning, context-gathering learning engine

## The problem

Students learn from scattered sources (their own notes and PDFs, forum answers, the web) and get generic AI answers that know nothing about them.

- **Answers ignore the learner.** A chatbot explains photosynthesis the same way to a beginner and an expert, and forgets everything next session.
- **Answers ignore the learner's own material.** Notes, slides and PDFs sit in a folder, apart from the tool that answers questions.
- **Community knowledge is untrusted and unsearchable.** Good peer answers are buried, and bad ones look the same.
- **Practice is disconnected from explanation.** Quizzes, timers and revision plans live in other apps and never feed back into what the learner studies next.

## What Entropy does

Entropy answers a learner's questions from **their own resources, trusted community answers and the web**, remembers what they know, and turns every interaction into practice.

| Capability | What the learner gets |
|---|---|
| Ask and learn | Answers with citations from uploaded resources, community answers and web search |
| Learner memory | Concept mastery and focus time per topic are tracked; quiz difficulty and review queues follow mastery |
| Quizzes, flashcards and assessments | Generated questions and flashcards, rubric-based grading with explainable scores |
| Focus timer | Pomodoro sessions tied to a topic; focus time per topic is kept in the learner profile |
| Mind maps | Concept maps generated from a question or a document |
| Slides and artifacts *(milestone 2)* | Generated slide decks and interactive artifacts, rendered in a sandbox |
| Communities | Reddit-style communities: join, post, threaded comments, up/down votes, hot/new/top ranking, moderators and rules. Plus Q&A with accepted answers, reputation, achievements and leaderboards |

## How it works

```
Browser -> Next.js (UI, auth, API routes, Prisma)       [Vercel]
              | server-only token + verified user id
              v
          FastAPI AI service (skills, memory, queues)    [Render]
              -> Groq via LangChain (LLM)
              -> fastembed (local embeddings)
              -> Pinecone (vector search)
              -> Neo4j Aura Free (concept graph)
              -> Supabase Postgres + Storage
```

- **Memory:** working (current conversation), episodic (conversations, quiz attempts, study sessions in Postgres), semantic (documents in Pinecone, concepts in Neo4j), procedural (the learner profile). Automatic summarising of sessions into the profile is planned.
- **Skills:** ask/explain, quiz, flashcards, mind map, study plan. A unified skill registry with an intent router is planned.
- **Queues:** work such as mastery updates, XP and memory consolidation runs on in-process message queues, with events persisted so a restart does not lose them. There is no SQS or Lambda.
- **Auth:** the browser talks only to Next.js. Next.js verifies the session and calls the AI service with a server-side token.

## Scope

- **In scope:** the capabilities in the table above, running on free-tier hosting.
- **Out of scope for now:** paid cloud services (AWS Bedrock, RDS, Lambda), native mobile apps, live video tutoring.

## Repository layout

```
apps/app        Next.js 14 app (TypeScript pages, JavaScript API routes, Prisma schema)
apps/ai-agent   FastAPI AI service (Python)
packages/       shared lint and TypeScript configs
docs/           architecture notes
REQUIREMENTS.md problem statement and requirements
```

## Run locally

### Everything in Docker (recommended)

```bash
cp apps/ai-agent/.env.example apps/ai-agent/.env   # add your GROQ_API_KEY (free at console.groq.com)
docker compose up --build
```

That starts Postgres, Neo4j, the AI service and the web app, applies the migrations and seeds demo data.

| Service | URL |
|---|---|
| Web app | http://localhost:5000 |
| AI service | http://localhost:8000/health |
| Postgres / Neo4j browser | `localhost:5442` / http://localhost:7474 (`neo4j` / `entropy_neo4j`) |

**Demo accounts.** The compose stack turns on a password-free demo login (only ever offered when `NEXTAUTH_URL` is `localhost`, so it cannot be enabled on a real deployment). On the sign-in page pick one:

| Account | What it is |
|---|---|
| `student@local.dev` | has joined most communities, has questions and answers |
| `student2@local.dev` | a second learner, for testing interactions |
| `mentor@local.dev` | admin of CS Fundamentals and ML From Scratch, has a mentor profile |

Any other `name@local.dev` also works and creates a fresh account. The seed also adds six communities with threaded discussion, votes and a few Q&A threads. Set `SEED_DEMO=false` on the `migrate` service to skip the demo content.

**The AI tutor** needs only the Groq key. Document search uses Postgres by default; set `PINECONE_API_KEY` to use Pinecone instead. Upload a document in AI study, then ask about it: answers cite it.

**Check it works end to end.** With the stack running:

```bash
node scripts/simulate.mjs             # signs in, plays out community + AI flows, 68 checks
node scripts/simulate.mjs --skip-ai   # community and auth only (no LLM calls)
```

Groq's free tier rate-limits (HTTP 429). The tutor then slows down or skips optional steps rather than failing; repeated simulation runs in a minute can trigger it.

Sign in with Google or GitHub by exporting `GOOGLE_CLIENT_ID/SECRET` or `GITHUB_ID/SECRET` before `docker compose up` (callback `http://localhost:5000/api/auth/callback/<google|github>`). Providers without credentials are simply not shown.

### Apps outside Docker

Run only the databases in Docker and the two apps on your machine:

```bash
docker compose up -d postgres neo4j

npm install
cp apps/app/.env.example apps/app/.env.local      # set ENABLE_DEV_LOGIN=true for the demo login
npm run db:deploy && npx tsx apps/app/prisma/seed.ts

cd apps/ai-agent                                   # Python 3.12
python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
prisma generate
uvicorn app.main:app --port 8000

npm run dev:app                                    # in another terminal, http://localhost:5000
```

Local values for the two env files:

| Variable | Value |
|---|---|
| `DATABASE_URL`, `DIRECT_URL` (both files) | `postgresql://entropy_user:entropy_pass@localhost:5442/entropy` |
| `NEO4J_URI` / `NEO4J_USER` / `NEO4J_PASSWORD` (ai-agent) | `bolt://localhost:7687` / `neo4j` / `entropy_neo4j` |
| `AI_BACKEND_TOKEN` (both files) | any string, identical in both |
| `NEXTAUTH_URL` / `NEXT_PUBLIC_APP_URL` | `http://localhost:5000` |
| `NEXTAUTH_SECRET` | any random string (a fixed development fallback is used if unset outside production) |
| `BACKEND_URL` (web) | `http://localhost:8000` |
| `GROQ_API_KEY` (ai-agent) | free key from console.groq.com; without it the tutor returns a clear "not configured" error |
| `PINECONE_API_KEY` (ai-agent) | optional; without it document search runs on Postgres |

On first start the AI service seeds the concept graph (about 285 concepts) and keeps growing it from the questions asked. Hosting is covered in [DEPLOYMENT.md](DEPLOYMENT.md).

## Status

Deployable: the web app builds with type and lint checks on, the AI service ships as a Docker image, and CI runs both. Slides and sandboxed artifacts are next. Requirements are in `REQUIREMENTS.md`.
