# Database System Design — NOVYRA

This document describes the production-grade database architecture for NOVYRA: a hybrid system using PostgreSQL (Prisma) for relational, OLTP data and Neo4j for the knowledge graph core.

## Goals

- Strong data integrity for users, community content, and audit logs
- Fast graph traversals for prerequisites, recommendations, and mastery
- Deterministic, reproducible evaluation & mastery updates
- Operational readiness: backups, monitoring, connection pooling, and scaling

---

## Logical Components

- **Relational Store (Postgres + Prisma)** — primary source of truth for users, posts, attempts, mastery records, rubric evaluations, gamification ledger, and audit logs. Prisma client used by application services.
- **Knowledge Graph (Neo4j)** — stores `Concept` nodes, `PREREQUISITE_OF`, `MASTERED_BY`, and `PART_OF` relationships for efficient traversal and curriculum planning.
- **Event / Audit Logs** — immutable append-only logs (Postgres table + optional write to object storage) capturing attempts, evaluation results, and model prompts/responses for traceability.
- **Vector Store** (optional) — Chroma or Pinecone for retrieval if RAG/semantic search is needed in future.

---

## Prisma Schema (relational highlights)

Key models (see `apps/app/prisma/schema.prisma`):

- `User` — profile, auth, gamification state
- `Concept`, `ConceptPrerequisite` — mirrored relational representation of graph concepts for efficient joins and analytics
- `ConceptAttempt` — audit record for each student attempt (time, hints used, correctness, delta)
- `MasteryRecord` — latest per-user per-concept mastery snapshot (total/correct/confidence weight)
- `RubricEvaluation` — stored evaluation JSON + computed weighted_total

Design notes:

- Keep audit/audit-like tables partitioned by time (monthly) if write volume grows.
- Use JSONB for LLM prompts/responses and rubric detail to retain fidelity.

---

## Neo4j Knowledge Graph

Purpose: fast neighborhood/prerequisite queries, shortest-path recommendations, weak-node detection and curriculum planning.

Model:

- `(:Concept { name, domain, difficulty, createdAt })`
- `(pre)-[:PREREQUISITE_OF]->(concept)`
- `(user)-[r:MASTERED_BY {score, updatedAt}]->(concept)`

Best practices:

- Keep node properties compact — store bulk metadata in Postgres and only the traversal-critical properties in Neo4j.
- Use parameterised Cypher queries and prepared statements via the official async driver.

---

## Consistency and Sync

Pattern: Postgres is primary for app data. Neo4j is a derived store for graph queries.

- Writes: application writes to Postgres first inside a transaction; then an async job (background worker or DB trigger pushing to a queue) updates Neo4j.
- Compensating jobs reconcile Neo4j nightly for drift.

---

## Indexing & Query Patterns

- Postgres:
  - Index `users.email`, `concept_attempts(userId, conceptId)`, `mastery_records(userId, conceptId)`
  - GIN indexes for JSONB fields storing rubric/LLM artifacts
  - Time-based partitioning for `concept_attempts` to support high write throughput

- Neo4j:
  - Index `:Concept(name)` and `:User(id)`
  - Use `shortestPath()` carefully; prefer k-hop expansions for controlled performance

---

## Scaling & Operational Concerns

- Connection Pooling: use PgBouncer (transaction pooling) for the app pool; Prisma is compatible when using session pooling patterns.
- Read replicas: route analytical read load (leaderboards, analytics) to read replicas.
- Backups: daily logical backups (pg_dump) + point-in-time recovery (PITR) enabled for critical environments.
- Neo4j: snapshot backups (hot) and scheduled consistency checks; use read replicas for heavy graph read traffic where supported.

---

## Security & Secrets

- Store DB credentials in environment variables and secret stores (Vault, AWS Secrets Manager).
- Rotate service credentials regularly; use short-lived tokens for cloud DBs.
- Principle of least privilege for DB users — separate roles for schema migrations, app runtime, and analytics.

---

## Disaster Recovery & Backups

- Postgres: daily full backups + continuous WAL archiving for PITR.
- Neo4j: periodic snapshots + export of key nodes/relationships to CSV/JSON as secondary backup.

Recovery RTO/RPO targets should be documented per environment (dev/staging/prod).

---

## Observability

- Instrument DB queries and long-running Cypher with tracing (OpenTelemetry).
- Export Postgres and Neo4j metrics to Prometheus; dashboards in Grafana for query latency, replication lag, connection counts.

---

## Operational Playbooks (short)

- **Add a new concept**: write to Postgres `Concept` and enqueue graph sync job → sync creates Neo4j node → run consistency check.
- **Mastery update**: write attempt to `ConceptAttempt`, run mastery recomputation job that writes `MasteryRecord` and updates Neo4j `MASTERED_BY` edge.
- **Repair Neo4j drift**: run nightly reconciliation job comparing Postgres `Concept`/`MasteryRecord` to graph and fix missing edges/nodes.

---

## Future Improvements

- Event sourcing for all student interactions (append-only stream) to allow full replay and reproducible offline evaluations.
- Materialised views for leaderboards with incremental refresh.
- Explore partitioned graphs / subgraph materialisation for very large curricula.

---

## Quick Start (dev)

1. Ensure `.env` contains `DATABASE_URL` and `NEO4J_URI`.
2. Start services: `docker-compose up --build`
3. Run Prisma migrations:

```bash
cd apps/app
npx prisma migrate dev --name novyra_init
```

4. Start app locally (AI Engine on `:8000`, frontend on `:5000`).

---

Contact the platform ops team for environment-specific RTO/RPO and scaling budgets.