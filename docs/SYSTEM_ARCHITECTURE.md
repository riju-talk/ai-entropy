# NOVYRA System Architecture (Complete Re-Architecture)

## Executive Summary

NOVYRA is an **AI-powered academic learning platform** with integrated gamification, trust systems, and anti-abuse mechanisms. The system is designed around **event-driven architecture** with strict separation of concerns:

1. **AI Brain** - Multi-layer reasoning and knowledge delivery
2. **Game Engine** - Non-exploitable XP, achievements, and reputation
3. **Trust System** - Anti-gaming detection and user credibility scoring
4. **Fact-Check Layer** - NLI-based validation of AI-generated content
5. **Event Bus** - Decoupled event processing for all state changes

---

## Core Design Principles

### 1. **Architecture-First**
- No direct state manipulation
- All changes flow through events
- Services are stateless and composable

### 2. **Trust-First**
- Every contribution is validated
- Trust scores influence all rewards
- Anti-gaming is built-in, not bolted on

### 3. **Learning-First**
- Rewards tied to mastery growth, not activity volume
- AI assists learning, doesn't replace it
- Community validation required for high-value actions

### 4. **Event-Driven**
- Single source of truth: event log
- Async processing for heavy computation
- Auditable, reversible, and debuggable

---

## System Boundaries

### Service Decomposition

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js Frontend                        │
│                 (apps/app - TypeScript)                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS / REST
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   FastAPI Backend                           │
│               (apps/ai-agent - Python)                      │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  AI Brain    │  │ Game Engine  │  │ Trust Engine │    │
│  │   Service    │  │   Service    │  │   Service    │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Fact-Check   │  │ Event Bus    │  │ Auth Service │    │
│  │   (NLI)      │  │              │  │              │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
       │                    │                    │
       │                    │                    │
       ▼                    ▼                    ▼
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│  PostgreSQL │    │    Neo4j     │    │   Redis     │
│  (Primary)  │    │ (Knowledge   │    │  (Cache +   │
│             │    │   Graph)     │    │   Queue)    │
└─────────────┘    └──────────────┘    └─────────────┘
```

---

## Storage Boundaries

### PostgreSQL (Primary Relational Store)
- **User accounts** (auth, profiles, credentials)
- **User-generated content** (doubts, answers, comments)
- **Voting records** (doubt votes, answer votes)
- **Gamification state** (XP, achievements, reputation, streaks)
- **Mastery tracking** (concept attempts, mastery records)
- **Rubric evaluations** (stored evaluations with scores)
- **Trust data** (trust scores, audit logs, abuse flags)
- **Event log** (append-only event history)

### Neo4j (Knowledge Graph)
- **Concept nodes** (structured academic concepts)
- **Prerequisite edges** (directed concept dependencies)
- **Semantic relationships** (related concepts, similarity scores)
- **Graph traversal** (prerequisite chains, recommendation paths)

### Redis (Cache + Queue)
- **Session cache** (active user sessions)
- **Rate limiting** (per-user request throttling)
- **Event queue** (async job processing)
- **Leaderboard cache** (materialized leaderboard snapshots)

---

## Event System

### Event Flow

```
User Action → API Endpoint → Validation → Event Emission
                                              ↓
                                         Event Bus
                                              ↓
                            ┌─────────────────┴─────────────────┐
                            ▼                                   ▼
                    Sync Handlers                       Async Workers
                    (immediate)                        (background)
                            │                                   │
                            ├─ Update DB                        │
                            ├─ Emit secondary events            │
                            │                                   │
                            └─────────────────┬─────────────────┘
                                              ↓
                                       State Updated
```

### Core Event Types

**Learning Events:**
- `DOUBT_CREATED` - User asks a question
- `ANSWER_SUBMITTED` - User answers a doubt
- `ANSWER_ACCEPTED` - Asker accepts an answer
- `CONCEPT_ATTEMPTED` - User attempts a concept evaluation
- `MASTERY_UPDATED` - User's mastery score changes
- `RUBRIC_EVALUATED` - AI evaluates a submission

**Gamification Events:**
- `XP_AWARDED` - User earns XP (derived from learning events)
- `ACHIEVEMENT_UNLOCKED` - User unlocks an achievement
- `REPUTATION_CHANGED` - User's reputation score changes
- `STREAK_UPDATED` - User's streak is updated

**Trust Events:**
- `NLI_FLAG_RAISED` - AI detects potential misinformation
- `VOTE_ANOMALY_DETECTED` - Unusual voting pattern detected
- `SIMILARITY_FLAG` - Content similarity threshold exceeded
- `TRUST_SCORE_UPDATED` - User's trust score recalculated

---

## Authentication & Authorization

### Authentication
- **NextAuth.js** for session management
- **JWT tokens** for API authentication
- **OAuth providers** (Google, GitHub)

### Authorization Levels
- `STUDENT` - Default role, can ask/answer, limited privileges
- `TEACHER` - Can moderate, create courses, higher trust weight
- `ADMIN` - Full system access, can override trust decisions

### Access Control
- **Route guards** (frontend + backend)
- **Resource ownership checks** (user can only edit own content)
- **Trust-based throttling** (low-trust users have stricter rate limits)

---

## API Design Patterns

### RESTful Endpoints
```
GET    /api/doubts              → List doubts (paginated)
POST   /api/doubts              → Create doubt
GET    /api/doubts/:id          → Get doubt details
DELETE /api/doubts/:id          → Delete doubt (owner only)

POST   /api/doubts/:id/answers  → Submit answer
POST   /api/answers/:id/accept  → Accept answer (asker only)
POST   /api/answers/:id/vote    → Vote on answer

POST   /api/ai/reason           → Get AI reasoning (authenticated)
POST   /api/ai/evaluate         → Submit for rubric evaluation
GET    /api/mastery/user/:id    → Get user's mastery records
```

### Rate Limiting Strategy
- **Global**: 1000 requests/hour/IP
- **Per-user**: 100 requests/hour for low-trust users, 500 for verified
- **AI endpoints**: 10 requests/hour (resource-intensive)
- **Vote endpoints**: 100 votes/hour (prevent vote manipulation)

---

## Scalability Considerations

### Horizontal Scaling
- **Stateless backend** - all services can scale independently
- **Database connection pooling** - Prisma with pool size = 10
- **Neo4j read replicas** - for knowledge graph queries
- **Redis Cluster** - for distributed caching

### Performance Optimization
- **Materialized views** for leaderboards (refresh every 5 minutes)
- **Denormalized XP totals** on User table (updated by events)
- **Cached concept prerequisites** (invalidated on graph changes)
- **Background workers** for heavy AI computations

### Monitoring & Observability
- **Structured logging** (JSON format with context)
- **Performance metrics** (request latency, DB query times)
- **Health checks** (DB connectivity, Neo4j, Redis)
- **Event queue monitoring** (queue depth, processing lag)

---

## Security Architecture

### Input Validation
- **Zod schemas** for all API inputs
- **SQL injection protection** via Prisma ORM
- **XSS prevention** - sanitized HTML rendering
- **Content-Security-Policy** headers

### Secrets Management
- **Environment variables** for all secrets
- **No hardcoded credentials** in codebase
- **JWT secret rotation** (monthly)

### Abuse Prevention
- **Rate limiting** (per-user, per-IP)
- **CAPTCHA** for high-value actions (if trust score < threshold)
- **Email verification** required for full access
- **Automated abuse detection** (trust system)

---

## Deployment Architecture

### Production Environment
```
User → Cloudflare CDN → Vercel (Next.js)
                            ↓
                       Render (FastAPI)
                            ↓
              ┌─────────────┴─────────────┐
              ▼                           ▼
      Neon Postgres              Aiven Neo4j
      (Serverless)               (Managed)
```

### Environment Variables
**Backend (.env):**
```
DATABASE_URL=postgresql://...
NEO4J_URI=bolt://...
REDIS_URL=redis://...
GOOGLE_API_KEY=...
JWT_SECRET=...
```

**Frontend (.env.local):**
```
NEXTAUTH_URL=https://...
NEXTAUTH_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
DATABASE_URL=postgresql://...
```

---

## Tech Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 14 (App Router) | React framework with SSR |
| Backend | FastAPI (Python 3.11+) | High-performance API server |
| Primary DB | PostgreSQL (via Prisma) | Relational data + transactions |
| Graph DB | Neo4j | Knowledge graph + traversal |
| Cache/Queue | Redis | Session cache + job queue |
| Auth | NextAuth.js | OAuth + JWT sessions |
| AI/LLM | Google Gemini API | Reasoning + evaluation |
| NLI Model | DistilRoBERTa (ONNX) | Fact-checking (CPU-optimized) |
| ORM | Prisma | Type-safe database access |
| Validation | Zod | Runtime type checking |

---

## Next Steps

This document establishes the **system-level boundaries and patterns**. The following architecture documents will detail:

1. **AI_BRAIN_ARCHITECTURE.md** - 8-layer reasoning system
2. **GAME_ENGINE_ARCHITECTURE.md** - XP, achievements, reputation
3. **TRUST_AND_ABUSE_MODEL.md** - Anti-gaming detection
4. **NLI_ARCHITECTURE.md** - Fact-checking layer

Each document will specify:
- Input/output contracts
- State transitions
- Event emissions
- Database schemas
- API endpoints
- Test coverage requirements

---

**Document Version:** 1.0  
**Last Updated:** 2026-02-27  
**Status:** ✅ Approved for Implementation
