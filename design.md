# System Design Document

## Project
**ENTROPY – AI Learning Acceleration Platform**

**Version:** 1.0  
**Date:** 2026-02-16  
**Based On:** SRS v1.0 (`requirements.md`)

---

## 1. Overview
ENTROPY is a web-based AI learning and developer productivity platform for AI for Bharat. It combines a custom RAG pipeline, knowledge graph reasoning, document intelligence, adaptive learning, multilingual delivery, community collaboration, and gamification.

This document defines the end-to-end technical architecture and implementation design for production deployment aligned with the approved requirements.

### 1.1 Design Goals
- Deliver low-latency, grounded AI responses.
- Support adaptive learning through knowledge gap detection and graph-aware recommendations.
- Scale to high concurrent usage with high availability.
- Ensure robust security, data protection, and observability.
- Enable modular evolution of AI components without affecting core API contracts.

### 1.2 Architectural Style
- **Frontend:** SPA/SSR hybrid using Next.js.
- **Backend:** Modular monolith (initial) with async workers; service boundaries ready for microservice split.
- **AI Runtime:** Pipeline-oriented async orchestration.
- **Storage:** Polyglot persistence (PostgreSQL, MongoDB, vector DB, Neo4j).

---

## 2. High Level Architecture

### 2.1 Layered Architecture
1. **Frontend Layer** (Next.js + TypeScript + TailwindCSS)
   - UI rendering, session management, user interactions, dashboarding.
2. **Backend API Layer** (FastAPI)
   - REST APIs, authN/authZ, request orchestration, rate limiting.
3. **AI Processing Layer**
   - Query understanding, retrieval orchestration, LLM generation, safety checks.
4. **Knowledge Graph Layer**
   - Concept extraction, graph updates, graph reasoning and recommendations.
5. **Data Storage Layer**
   - PostgreSQL, MongoDB, Pinecone/FAISS, Neo4j, object storage.

### 2.2 High-Level Interaction Flow
- User request enters via frontend and authenticated API gateway.
- Backend orchestrator routes to AI pipeline and/or domain services.
- AI pipeline retrieves context from vector DB and graph DB, then generates response.
- Learning engine updates user model and recommendations.
- Community/gamification events persist to storage and publish to async workers.

### 2.3 Diagram: System Context and Layers
```mermaid
flowchart TB
  U[Users: Students / Developers / Researchers / Educators] --> FE[Frontend: Next.js]
  FE --> API[FastAPI API Layer]

  API --> ORCH[Request Orchestrator]
  ORCH --> AI[AI Processing Layer]
  ORCH --> APP[Domain Services\nCommunity / Gamification / Profile]

  AI --> RAG[Custom RAG Pipeline]
  AI --> LEARN[Adaptive Learning Engine]
  AI --> SAFETY[Safety & Moderation Filters]

  RAG --> VDB[(Vector Store\nPinecone / FAISS)]
  RAG --> DOC[(Document Store\nMongoDB + Object Storage)]
  RAG --> LLM[LLM Inference Engine]

  LEARN --> KG[Knowledge Graph Engine]
  KG --> NEO[(Neo4j)]
  LEARN --> SQL[(PostgreSQL)]

  APP --> SQL
  APP --> MONGO[(MongoDB)]

  API --> CACHE[(Redis Cache)]
  API --> MQ[(Task Queue / Event Bus)]
  MQ --> WORKERS[Async Workers]
  WORKERS --> DOC
  WORKERS --> VDB
  WORKERS --> NEO
```

---

## 3. AI System Design

### 3.1 Custom Retrieval Augmented Generation (RAG) Pipeline
**Constraint:** No LangChain; custom orchestration implemented as Python service modules.

#### 3.1.1 Query Processing Stages
1. **Input Normalization:** language detection, text cleanup, token budget estimate.
2. **Intent Classification:** classify into QA, code explanation, document QA, learning recommendation.
3. **Query Rewriting:** expand with synonyms and concept aliases.
4. **Retriever Fan-out:**
   - dense vector retrieval (top-k)
   - optional sparse/BM25 lexical retrieval
   - graph neighborhood expansion (concept-adjacent nodes)
5. **Context Reranking:** cross-encoder reranker selects high-relevance chunks.
6. **Prompt Composition:** instruction + user context + retrieved evidence + safety constraints.
7. **LLM Generation:** produce answer with grounded references.
8. **Post-processing:** citation stitching, toxicity/safety checks, multilingual translation if requested.

#### 3.1.2 RAG Pipeline Diagram
```mermaid
flowchart LR
  Q[User Query] --> N[Normalize & Detect Language]
  N --> I[Intent Classifier]
  I --> R[Query Rewriter]
  R --> D[Dense Retrieval]
  R --> S[Sparse Retrieval]
  R --> G[Graph Context Expansion]
  D --> RR[Reranker]
  S --> RR
  G --> RR
  RR --> P[Prompt Builder]
  P --> L[LLM Inference]
  L --> C[Citation + Safety + Translation]
  C --> A[Final Response]
```

### 3.2 Document Ingestion Pipeline
1. Upload validation (size/type/security scan).
2. File persistence to object storage.
3. Parsing (PyMuPDF for PDF, python-docx for DOCX, native TXT parser).
4. Structural segmentation (title, section, paragraph, table blocks).
5. Text cleanup and language detection.
6. Chunking with overlap (semantic-aware chunker).
7. Embedding generation for chunks.
8. Vector indexing in Pinecone/FAISS.
9. Metadata persistence (MongoDB + PostgreSQL references).
10. Entity/concept extraction and graph update.

### 3.3 Embedding Generation Process
- **Model abstraction:** pluggable transformer embedding model interface.
- **Batching:** dynamic micro-batching to maximize GPU/CPU throughput.
- **Chunk policy:** target token window with overlap for continuity.
- **Versioning:** store embedding model version and chunk hash.
- **Re-index strategy:** triggered on model upgrade or parsing policy changes.

### 3.4 Vector Similarity Search
- Top-k nearest neighbors using cosine similarity.
- Metadata filters: user scope, document scope, language, recency.
- Hybrid retrieval mode: weighted fusion of dense + sparse ranks.
- Optional MMR diversification to reduce redundant chunks.

### 3.5 Knowledge Graph Construction and Reasoning
- **Entity/Concept extraction:** spaCy NER + rule-based domain phrase extraction.
- **Relationship extraction:** pattern + dependency parsing + co-occurrence scoring.
- **Graph schema:** nodes (Concept, Topic, Resource, Skill), edges (PREREQUISITE_OF, RELATED_TO, APPLIED_IN, EXPLAINS).
- **Reasoning operations:**
  - prerequisite traversal
  - weak-link (knowledge gap) detection
  - next-best-concept ranking
  - path explanation for recommendation transparency

### 3.6 Adaptive Learning Engine
- Inputs: user profile, activity stream, correctness signals, session behavior, graph state.
- Learner model computes concept mastery scores in range [0,1].
- Recommendation strategy:
  - prioritize high-impact prerequisites
  - blend user goals with graph centrality and difficulty slope
  - avoid abrupt jumps in complexity
- Outputs: next topic list, estimated study time, confidence.

### 3.7 LLM Response Generation
- Supports task templates: explain, summarize, code explain, compare concepts.
- Enforces grounded generation with retrieval context and citation tags.
- Safety layer blocks disallowed responses; fallback to safe response templates.
- Optional translation post-pass for regional language output.

---

## 4. Component Design

## 4.1 Frontend Design (Next.js)

### 4.1.1 Architecture
- **Routing:** Next.js App Router.
- **Rendering strategy:**
  - SSR for SEO/public pages.
  - CSR for interactive dashboards and chat sessions.
- **State management:** React Query for server state + lightweight client store for UI state.
- **API integration:** typed client using OpenAPI-generated interfaces.

### 4.1.2 UI Modules
1. Authentication module
2. AI Chat & Explanation module
3. Document workspace module
4. Knowledge graph explorer module
5. Learning path dashboard module
6. Community and mentorship module
7. Gamification (XP, coins, leaderboards) module
8. Profile and language preferences module
9. Admin moderation module

### 4.1.3 Frontend Authentication Flow
1. User submits credentials/OAuth token.
2. Backend returns signed access token + refresh token.
3. Access token attached to API requests.
4. Silent refresh before expiry.
5. Route guards enforce role-based page access.

### 4.1.4 Diagram: Frontend Module Map
```mermaid
flowchart TB
  APP[Next.js App] --> AUTH[Auth]
  APP --> CHAT[AI Chat]
  APP --> DOCS[Document Workspace]
  APP --> GRAPH[Knowledge Graph View]
  APP --> LEARN[Learning Path]
  APP --> COMM[Community]
  APP --> GAME[Gamification]
  APP --> PROFILE[Profile/Language]
  APP --> ADMIN[Admin]
```

## 4.2 Backend Design (FastAPI)

### 4.2.1 Service Modules
- `auth_service`: login, token lifecycle, RBAC.
- `user_service`: profile, preferences, goals.
- `ai_service`: query orchestration and response generation.
- `document_service`: upload, parsing jobs, document metadata.
- `kg_service`: concept graph CRUD and reasoning APIs.
- `learning_service`: mastery model and recommendations.
- `community_service`: posts, answers, mentorship matching.
- `gamification_service`: XP, coins, levels, achievements.
- `admin_service`: moderation and analytics endpoints.

### 4.2.2 API Endpoint Groups (Representative)
- `/api/v1/auth/*`
- `/api/v1/users/*`
- `/api/v1/ai/query`
- `/api/v1/documents/upload`, `/api/v1/documents/{id}/ask`
- `/api/v1/graph/concepts`, `/api/v1/graph/recommendations`
- `/api/v1/learning/path`, `/api/v1/learning/gaps`
- `/api/v1/community/posts`, `/api/v1/community/mentorship`
- `/api/v1/gamification/profile`, `/api/v1/gamification/leaderboard`
- `/api/v1/admin/moderation/*`

### 4.2.3 Async Processing
- Celery/RQ worker pool for ingestion, embedding, graph updates, and scheduled recomputation.
- Task states tracked in PostgreSQL; progress events pushed to clients via WebSocket/SSE.
- Retry policy with exponential backoff and dead-letter queue for persistent failures.

## 4.3 AI Component Design

### 4.3.1 Document Processing Pipeline
- Ingestion API stores file and creates processing job.
- Worker executes parser -> chunker -> embedding -> indexer.
- Output artifacts linked by `document_id` and `chunk_id`.

### 4.3.2 NLP Entity Extraction
- spaCy pipeline + custom phrase matcher for AI/CS domain terms.
- Entity confidence thresholds and post-filtering to reduce noise.

### 4.3.3 Embedding Engine
- Stateless service endpoint for embedding batches.
- Supports CPU fallback when GPU unavailable.

### 4.3.4 Knowledge Graph Engine
- Batch upsert nodes/edges into Neo4j.
- Relationship confidence and provenance metadata stored per edge.

### 4.3.5 Learning Engine
- Periodic and event-driven mastery score updates.
- Returns recommended sequence with rationale from graph paths.

---

## 5. Data Flow Design

### 5.1 User Query Flow
1. Frontend sends authenticated query.
2. API gateway validates token and rate limits request.
3. AI orchestrator classifies intent.
4. RAG and graph context retrieval executed.
5. LLM generates grounded response.
6. Safety + translation + formatting applied.
7. Response returned and interaction event logged.
8. Learning engine receives event for mastery update.

### 5.2 Document Upload Flow
1. User uploads file and metadata.
2. Backend validates and stores file.
3. Async job parses and chunks content.
4. Embeddings generated and indexed.
5. Concept extraction updates graph.
6. Job status updates visible in UI.

### 5.3 AI Reasoning Pipeline Flow
- Query -> retrieval evidence -> graph context -> rerank -> generation -> citation + safety -> response.

### 5.4 Knowledge Graph Update Flow
1. New document/query interaction event captured.
2. Candidate entities/relations extracted.
3. Confidence-scored updates merged with deduplication.
4. Graph consistency checks and provenance tagging.
5. Recommendation cache invalidation and refresh.

### 5.5 Diagram: End-to-End Query + Learning Update
```mermaid
sequenceDiagram
  participant User
  participant FE as Frontend
  participant API as FastAPI
  participant AI as AI Orchestrator
  participant VDB as Vector DB
  participant KG as Neo4j/KG Engine
  participant LLM as LLM Engine
  participant LE as Learning Engine

  User->>FE: Ask technical question
  FE->>API: POST /ai/query
  API->>AI: Route request
  AI->>VDB: Retrieve relevant chunks
  AI->>KG: Fetch related concepts/prereqs
  AI->>LLM: Generate grounded answer
  LLM-->>AI: Draft response
  AI-->>API: Response + citations
  API-->>FE: Return answer
  API->>LE: Emit interaction event
  LE->>KG: Update mastery-linked concept weights
```

---

## 6. Database Design

## 6.1 Storage Responsibility Matrix
- **PostgreSQL:** transactional user/profile/auth, learning progress snapshots, gamification counters, community metadata.
- **MongoDB:** document chunks, retrieval metadata, conversation transcripts, flexible AI artifacts.
- **Neo4j:** concept graph nodes/edges and reasoning indexes.
- **Pinecone/FAISS:** embedding vectors for retrieval.
- **Object Storage:** raw uploaded files.

## 6.2 Logical Schemas

### 6.2.1 User Schema (PostgreSQL)
- `users(user_id, email, password_hash, role, status, created_at, updated_at)`
- `user_profiles(user_id, display_name, bio, preferred_language, goals, skill_level)`
- `user_sessions(session_id, user_id, refresh_token_hash, expires_at, device_info)`

### 6.2.2 Document Schema (MongoDB + PostgreSQL index table)
- Mongo collection `documents`
  - `_id`, `user_id`, `title`, `file_type`, `storage_uri`, `status`, `metadata`, `created_at`
- Mongo collection `document_chunks`
  - `_id`, `document_id`, `chunk_index`, `text`, `language`, `embedding_id`, `section_ref`
- PostgreSQL `document_jobs(job_id, document_id, state, progress, error_code, started_at, ended_at)`

### 6.2.3 Community Schema (PostgreSQL)
- `communities(community_id, name, domain, visibility, created_by, created_at)`
- `posts(post_id, community_id, author_id, title, body, upvotes, accepted_answer_id, created_at)`
- `answers(answer_id, post_id, author_id, body, upvotes, created_at)`
- `mentorship_requests(request_id, mentee_id, domain, goals, status, created_at)`
- `mentorship_matches(match_id, mentor_id, mentee_id, score, status, created_at)`

### 6.2.4 Gamification Schema (PostgreSQL)
- `xp_ledger(entry_id, user_id, source_type, source_id, xp_delta, created_at)`
- `coin_ledger(entry_id, user_id, source_type, source_id, coin_delta, created_at)`
- `user_levels(user_id, level, total_xp, updated_at)`
- `achievements(achievement_id, code, title, criteria_json)`
- `user_achievements(user_id, achievement_id, unlocked_at)`
- `leaderboard_snapshots(snapshot_id, period, domain, ranking_json, generated_at)`

### 6.2.5 Knowledge Graph Storage (Neo4j)
- Node labels: `Concept`, `Topic`, `Skill`, `Resource`, `UserConceptState`
- Edge types: `PREREQUISITE_OF`, `RELATED_TO`, `APPLIED_IN`, `EXPLAINS`, `LEARNING_EDGE`
- Key properties: `confidence`, `source`, `last_validated_at`, `weight`

### 6.2.6 Diagram: Data Stores and Ownership
```mermaid
flowchart LR
  API[FastAPI Services] --> PG[(PostgreSQL)]
  API --> M[(MongoDB)]
  API --> N[(Neo4j)]
  API --> V[(Pinecone/FAISS)]
  API --> O[(Object Storage)]

  W[Async Workers] --> M
  W --> N
  W --> V
  W --> O
```

---

## 7. Deployment Architecture

### 7.1 Containerization (Docker)
- Each service packaged as independent Docker image:
  - `frontend` (Next.js)
  - `api` (FastAPI)
  - `worker` (async jobs)
  - `scheduler` (periodic tasks)
  - `redis` (cache/queue broker)
- Images versioned by commit SHA and semantic release tag.

### 7.2 CI/CD Pipeline
1. Code push triggers CI workflow.
2. Linting, unit tests, integration tests.
3. Security scans (SAST + dependency scan).
4. Build and publish Docker images.
5. Deploy to staging; run smoke tests.
6. Manual/automated promotion to production.
7. Blue-green or rolling deployment strategy.

### 7.3 Cloud Deployment Model
- Kubernetes-based deployment (managed cluster preferred).
- Ingress + TLS termination.
- Managed databases (PostgreSQL, MongoDB, Neo4j/Pinecone where applicable).
- Object storage for file assets.
- CDN for static assets and edge caching.

### 7.4 Scalability Strategy
- Horizontal Pod Autoscaler on API and workers.
- Queue-driven worker autoscaling based on backlog depth.
- Read replicas for relational/document stores where needed.
- Cache hot paths for retrieval metadata and session context.

### 7.5 Diagram: Deployment Topology
```mermaid
flowchart TB
  CDN[CDN + WAF] --> INGRESS[K8s Ingress]
  INGRESS --> FE[Frontend Pods]
  INGRESS --> API[API Pods]

  API --> REDIS[(Redis)]
  API --> PG[(Managed PostgreSQL)]
  API --> MONGO[(Managed MongoDB)]
  API --> NEO[(Neo4j)]
  API --> VEC[(Pinecone/FAISS)]
  API --> OBJ[(Object Storage)]

  REDIS --> WORKER[Worker Pods]
  WORKER --> MONGO
  WORKER --> NEO
  WORKER --> VEC
  WORKER --> OBJ

  OBS[Observability Stack\nLogs/Metrics/Traces] --> API
  OBS --> WORKER
  OBS --> FE
```

---

## 8. Security Design

### 8.1 Authentication
- JWT-based access token + rotating refresh token.
- OAuth2/OpenID Connect optional for social/enterprise login.
- Session revocation and device-aware login records.

### 8.2 Authorization
- Role-based access control: learner, mentor, educator, admin.
- Resource-level checks on document ownership and community permissions.
- Admin-only moderation and analytics actions.

### 8.3 Data Protection
- TLS 1.2+ for all in-transit traffic.
- Encryption at rest for database and object storage.
- Hashing and salting for password storage (`argon2`/`bcrypt`).
- PII minimization and configurable retention policies.

### 8.4 Application Security Controls
- Input validation and output encoding.
- API rate limiting and abuse detection.
- CSRF protection where cookie-based flows are used.
- Prompt injection mitigation via context isolation and allowlist policies.
- Audit logging for admin/moderation actions.

---

## 9. Performance Optimization

### 9.1 Caching Strategies
- Redis cache layers:
  - auth/session token metadata cache
  - frequent query-response cache with short TTL
  - recommendation cache per user snapshot
- CDN caching for static assets and non-sensitive public resources.

### 9.2 Indexing Strategy
- PostgreSQL composite indexes on high-traffic query paths.
- MongoDB indexes on `document_id`, `user_id`, `created_at`, and status fields.
- Neo4j indexes on concept identifiers and relationship traversal keys.
- Vector index tuning for dimension, metric, and top-k latency.

### 9.3 Asynchronous Processing
- Offload heavy tasks: parsing, OCR, embedding, graph recompute, leaderboard snapshot generation.
- Non-blocking API patterns with job status polling/WebSocket notifications.

### 9.4 Capacity Targets (Aligned with NFR)
- P95 AI response <= 3.5s for standard QA under normal load.
- P95 document QA <= 5s for indexed documents.
- Monthly availability >= 99.9%.

---

## 10. Reliability, Observability, and Operations

### 10.1 Reliability Patterns
- Idempotent job submission keys for ingestion.
- Circuit breakers for external model/vector services.
- Retry with backoff and dead-letter queue handling.

### 10.2 Observability
- Structured logs with correlation IDs.
- Metrics: latency, token usage, retrieval hit rates, failure rates, queue lag.
- Distributed tracing across API -> retrieval -> generation -> post-processing.
- Alerting on SLA/SLO breaches and anomalous error spikes.

### 10.3 Operational Runbooks
- Incident triage workflow and severity matrix.
- Rollback plan for model and service deployments.
- Backup and restore validation (daily backups, periodic restore drills).

---

## 11. Implementation Roadmap (Suggested)

### Phase 1 (MVP)
- Auth, AI query, document upload + RAG, basic communities, baseline gamification, multilingual translation.

### Phase 2
- Full knowledge graph reasoning, adaptive learning path engine, mentorship matching, advanced moderation.

### Phase 3
- Advanced analytics, model optimization, expanded language coverage, personalization tuning.

---

## 12. Risks and Mitigations
1. **Hallucinations / low grounding quality**  
   Mitigation: stronger reranking, citation enforcement, confidence-based fallback.

2. **High inference cost**  
   Mitigation: caching, model routing by task complexity, token budget controls.

3. **Graph quality drift**  
   Mitigation: confidence thresholds, periodic validation jobs, provenance tracking.

4. **Latency spikes under peak load**  
   Mitigation: autoscaling, queue smoothing, degraded-mode responses.

5. **Multilingual translation inconsistency**  
   Mitigation: language-specific QA datasets, post-edit quality scoring, glossary constraints.

---

## 13. Diagram Descriptions (Textual Summary)
- **System Context and Layers:** Shows users interacting with frontend, backend orchestration, AI layer, graph layer, and polyglot storage.
- **RAG Pipeline:** Shows sequential and parallel steps from normalization through retrieval, reranking, generation, and safety/translation.
- **Frontend Module Map:** Shows main UI modules and their grouping in Next.js app architecture.
- **End-to-End Sequence:** Shows query lifecycle from user request to response and learning model update.
- **Data Ownership Diagram:** Shows which services write/read from PostgreSQL, MongoDB, Neo4j, vector store, and object storage.
- **Deployment Topology:** Shows cloud edge, Kubernetes services, managed databases, workers, and observability stack.

---

## 14. Technology Mapping
- **Frontend:** Next.js, TypeScript, TailwindCSS
- **Backend:** FastAPI (Python)
- **AI/NLP:** custom RAG, transformer embeddings, spaCy, LLM inference engine
- **Retrieval:** Pinecone / FAISS
- **Graph:** Neo4j + NetworkX
- **Doc Processing:** PyMuPDF (+ DOCX/TXT parser stack)
- **Databases:** PostgreSQL, MongoDB
- **Infra:** Docker, Kubernetes, CI/CD pipeline, Redis cache/queue

---

## 15. Design Conformance to Requirements
- AI Learning Engine requirements are fulfilled via custom RAG, code explanation templates, graph-enhanced reasoning, and adaptive learning services.
- Document intelligence requirements are fulfilled via ingestion pipeline, chunking/indexing, and contextual QA APIs.
- Community and mentorship requirements are fulfilled through dedicated domain services and relational schemas.
- Gamification requirements are fulfilled via XP/coin ledgers, level computation, achievements, and leaderboard snapshots.
- Multilingual requirements are fulfilled via language-aware query handling and translation post-processing.
- Non-functional requirements are addressed through autoscaling, caching, async workloads, security controls, and observability.
