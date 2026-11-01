# Deploying Entropy (free tier)

Two deployables and a handful of managed services. Everything below has a free plan.

```
Browser -> Next.js on Vercel  --(X-Internal-Token + X-User-Id)-->  FastAPI on Render (Docker)
                |                                                     |
                +-- Supabase Postgres (Prisma) <----------------------+-- Groq (LLM)
                                                                      +-- Pinecone (vectors, 384-dim)
                                                                      +-- Neo4j Aura Free (concept graph)
                                                                      +-- Supabase Storage (uploads)
                                                                      +-- Tavily (web search, optional)
```

The browser only ever talks to Next.js. Next.js checks the NextAuth session and calls the AI service with a
shared secret, so the AI service is never exposed to users and never trusts a user id from the client.

## 1. Create the services

| Service | What to create | Notes |
|---|---|---|
| Supabase | A project | Copy two connection strings: the **pooled** one (port 6543) and the **direct** one (port 5432). In Storage create a **private** bucket named `documents`. Copy the project URL and the `service_role` key. |
| Groq | An API key at console.groq.com | Free tier has per-minute limits; the service returns HTTP 429 with `Retry-After` when hit. |
| Pinecone | An index named `entropy-ai`, **384 dimensions**, cosine, serverless | Older 1536-dim indexes (Bedrock embeddings) are incompatible. Delete them and re-upload documents. |
| Neo4j Aura | A **Free** instance | Save the `neo4j+s://...` URI and password. Free instances pause after inactivity; the keep-alive workflow prevents that. |
| Tavily | An API key (optional) | Without it, answers use only your documents and the model. |
| Google / GitHub OAuth | An OAuth app each | Callback URL: `https://<your-vercel-domain>/api/auth/callback/google` and `/github`. |

## 2. Create the database tables

`apps/app/prisma/schema.prisma` is the single source of truth. From your machine, with the **direct** URL:

```bash
npm install
DATABASE_URL="<direct url>" DIRECT_URL="<direct url>" npm run db:push
```

If you change the schema later, run `npm run db:sync` to regenerate the Python copy at
`apps/ai-agent/prisma/schema.prisma` and commit both (CI fails if they drift).

## 3. Deploy the AI service to Render

1. Push the repo to GitHub. In Render choose **New > Blueprint** and select it; `apps/ai-agent/render.yaml` defines the service.
2. Fill in the secrets Render asks for (`AI_BACKEND_TOKEN`, `GROQ_API_KEY`, `DATABASE_URL`, `DIRECT_URL`,
   `PINECONE_API_KEY`, `NEO4J_URI`, `NEO4J_PASSWORD`, `TAVILY_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`,
   `ALLOWED_ORIGINS`).
   Generate the token with `openssl rand -hex 32` and keep a copy for step 4.
3. After the first deploy, `https://<service>.onrender.com/health` should return `200` with `"status": "healthy"`.
   `"degraded"` lists what is missing (for example `neo4j_connected: false`).

The image bakes in the embedding model, so cold starts do not download anything. The free plan has 512 MB of RAM;
the service runs one worker and loads the model on first use (about 400 MB resident).

## 4. Deploy the web app to Vercel

1. Import the repo. Set **Root Directory** to `apps/app`. Leave the install/build commands as detected
   (the build runs `prisma generate` first).
2. Environment variables (Production and Preview):

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Supabase **pooled** URL ending in `?pgbouncer=true&connection_limit=1` |
   | `DIRECT_URL` | Supabase direct URL |
   | `NEXTAUTH_URL` | `https://<your-vercel-domain>` |
   | `NEXT_PUBLIC_APP_URL` | `https://<your-vercel-domain>` (used for page metadata) |
   | `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_ID`, `GITHUB_SECRET` | From the OAuth apps |
   | `BACKEND_URL` | `https://<service>.onrender.com` |
   | `AI_BACKEND_TOKEN` | The same value you gave Render |

   Do not prefix any of these with `NEXT_PUBLIC_`; they must stay server-side.
3. Deploy, then set `ALLOWED_ORIGINS` on Render to the Vercel URL if you have not already.

## 5. Keep the free services awake

Render free sleeps after 15 minutes idle and Aura Free pauses after a few days. In the GitHub repository go to
**Settings > Secrets and variables > Actions > Variables** and add `AI_AGENT_HEALTH_URL` =
`https://<service>.onrender.com/health`. The `Keep services warm` workflow then pings it every 10 minutes and fails
(so you get an email) if the service is down.

## 6. Smoke test

1. Sign in on the Vercel URL.
2. AI Agent > upload a small PDF, then ask a question about it. You should get an answer with citations.
3. Generate a quiz and flashcards.
4. Study Timer > start a 15 minute session, end it, and see it counted under "Your focus".
5. `curl https://<service>.onrender.com/api/quiz/` without the token must return `401`.

## Troubleshooting

| Symptom | Cause |
|---|---|
| Every AI call returns 401 | `AI_BACKEND_TOKEN` differs between Vercel and Render, or is missing on one of them. |
| AI calls return 503 "AI provider is not configured" | `GROQ_API_KEY` missing on Render. |
| AI calls return 429 | Groq free-tier quota; wait a few seconds. |
| First request after idle takes ~30-60 s | Render cold start; the keep-alive workflow avoids it. |
| Uploads fail or ingest nothing | Pinecone index dimension is not 384, or the Supabase bucket does not exist. |
| Vercel build fails on Prisma | Missing `DATABASE_URL`/`DIRECT_URL` env vars in the project. |
| "Too many connections" errors | `DATABASE_URL` is not the pooled URL with `pgbouncer=true&connection_limit=1`. |
