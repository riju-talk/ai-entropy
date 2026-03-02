# Gamification — NOVYRA

This document explains how gamification integrates with NOVYRA's mastery and rubric systems. Gamification provides measurable incentives (XP, tokens, badges) derived from `ConceptAttempt`, `MasteryRecord`, and `RubricEvaluation` events.

## Principles

- Align rewards with learning objectives — mastery gains and rubric improvements should yield higher rewards than simple activity.
- Make rewards auditable and reversible — store events in append-only tables to allow rollbacks and audits.
- Decouple reward computation from UI — compute rewards in backend jobs to avoid client-side manipulation.

## Core Entities

- `ConceptAttempt` (Postgres): records each attempt with fields: `userId`, `conceptId`, `correct`, `confidence`, `hintsUsed`, `timeTaken`, `llmPrompt`, `llmResponse`.
- `MasteryRecord` (Postgres): per-user-per-concept snapshot capturing `score`, `level`, `updatedAt`.
- `RubricEvaluation` (Postgres): JSON evaluation stored along with a `weighted_total` for leaderboard calculations.
- `GamificationLedger` (Postgres): append-only ledger of rewards issued: `{ userId, type: 'xp'|'token'|'badge', amount, reason, metadata, createdAt }`.

## Reward Rules (examples)

- XP on Correct Attempt: base XP = 10; multiplier = 1 + (1 - difficulty/10). If attempt is correct and confidence >= 0.8, grant XP = base * multiplier * 1.5.
- Mastery Delta Bonus: when `MasteryRecord.score` increases by >= 0.05, award a one-time bonus XP proportional to delta.
- Rubric Improvement: if `RubricEvaluation.weighted_total` increases over previous evaluation, award XP = floor(delta * 100).
- Hints Penalty: deduct XP proportional to `hintsUsed` to encourage independent attempts.
- Badges: milestone badges (First Mastery, 10 Concepts Mastered, Subject Master) awarded when thresholds met.

## Computation Flow

1. User submits attempt → API writes `ConceptAttempt`.
2. Background worker recomputes mastery and writes `MasteryRecord`.
3. Reward engine computes delta vs previous `MasteryRecord` and writes to `GamificationLedger`.
4. Leaderboards and user-facing totals are materialised from `GamificationLedger`.

Notes:

- Steps 2–3 should be idempotent and resilient; use unique attempt IDs to avoid double-processing.
- Consider using job queues (Redis/RQ or Celery) for scalable background processing.

## Storage and Indexing

- Index `GamificationLedger(userId, createdAt)` for fast per-user balance queries.
- Materialised view `user_xp_totals` to precompute totals for leaderboards; refresh incrementally.

## Anti-Fraud and Integrity

- Keep server-side reward issuance; do not trust client input for reward calculation.
- Audit trail: store raw LLM prompts/responses and evaluation artifacts to support investigations.

## Leaderboards & Privacy

- Support opt-out for public leaderboards; store `leaderboard_opt_out` on `User`.
- Use caching and rate-limits on leaderboard endpoints to avoid exposing PII at scale.

## Extensibility

- Token economy: tokens minted on mastery unlocks and spendable on hints or learning resources.
- Time-limited events and seasonal leaderboards can be supported by tagging `GamificationLedger` entries with `eventId`.

---

## Quick Implementation Checklist

- Add `GamificationLedger` table to Prisma schema and generate migration.
- Implement background job to compute mastery deltas and ledger entries.
- Add endpoints to fetch user balances and leaderboards (read from materialised views).
- Ensure all reward computations are covered by unit tests.

---

Contact product/gamification owners to codify reward numbers and thresholds before production rollout.
