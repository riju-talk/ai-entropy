"""
Lambda Entry Point — NOVYRA AI Engine
======================================
AWS Lambda handler using Mangum adapter.

Mangum translates API Gateway HTTP events into ASGI requests
that FastAPI understands. The `app` import comes from apps/ai-agent/app/main.py
which is the NOVYRA full engine (not the legacy root main.py).

Environment variables (set in Lambda console or CDK):
  DATABASE_URL          — RDS PostgreSQL connection string
  AWS_REGION            — e.g. ap-northeast-1
  BEDROCK_CLAUDE_MODEL  — Claude model ID
  BEDROCK_TITAN_EMBED   — Titan embed model ID
  S3_BUCKET_NAME        — document bucket name
  NEO4J_URI             — still used until graph migration
  AI_BACKEND_TOKEN      — shared secret from Next.js gateway
"""

import logging
import os

from mangum import Mangum

# Use NOVYRA full engine (app/main.py) not the legacy root main.py
from app.main import app  # noqa: E402

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# ── Lambda handler ─────────────────────────────────────────────────────────
# lifespan="off" is required for Lambda — there is no persistent process.
# Each cold start runs startup logic inline per request (Prisma connect, etc.)

handler = Mangum(app, lifespan="off")

logger.info("NOVYRA Lambda handler registered — model: %s", os.getenv("BEDROCK_CLAUDE_MODEL", "unset"))
