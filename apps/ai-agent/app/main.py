"""
Entropy AI Engine — FastAPI Application

Mounts both legacy routes (qa, documents, quiz, flashcards, mindmap)
and new Entropy core engines (reasoning, evaluation, mastery, graph).
Port 8000 — unchanged so the Next.js frontend proxy continues to work.
"""
import os
import sys
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
from app.core.config import settings, validate_settings  # noqa: E402

validate_settings()

# ---------------------------------------------------------------------------
# Lifespan (startup / shutdown)
# ---------------------------------------------------------------------------
from app.services.knowledge_graph_service import (
    ping as neo4j_ping,
    close_driver,
    count_concepts,
)  # noqa: E402


@asynccontextmanager
async def lifespan(fastapi_app: FastAPI):
    logger.info("=" * 70)
    logger.info("Entropy AI Engine starting on port %s", settings.PORT)
    logger.info("    LLM   : %s", settings.LLM_MODEL)
    logger.info("    Neo4j : %s", settings.NEO4J_URI)
    logger.info("=" * 70)

    # Connect to PostgreSQL via Prisma (non-fatal — AI routes don't need Postgres to start)
    try:
        from app.core.database import connect_db
        await connect_db()
        logger.info("✅ PostgreSQL connected via Prisma")
    except BaseException as exc:
        # Catch BaseException (incl. SystemExit/KeyboardInterrupt) because Prisma's
        # Rust query engine calls sys.exit() when Postgres is unreachable on Windows,
        # which would otherwise kill the entire uvicorn process before any routes load.
        logger.warning("⚠️  PostgreSQL unavailable — AI routes will work without it: %s", exc)

    # Initialize Redis cache
    try:
        from app.core.cache import cache
        cache_connected = await cache.connect()
        if cache_connected:
            logger.info("✅ Redis cache connected")
        else:
            logger.warning("⚠️  Redis cache connection failed - caching disabled")
    except BaseException as exc:
        logger.warning("⚠️  Redis cache initialization failed: %s", exc)

    # Initialize event bus and register handlers
    try:
        from app.services.events.event_bus import get_event_bus
        # Import handlers to trigger @event_handler registration
        import app.services.events.event_handlers  # noqa: F401
        
        event_bus = get_event_bus()
        handler_count = len(event_bus._handlers)
        logger.info("✅ Event bus initialized with %d handlers", handler_count)
    except Exception as exc:
        logger.error("❌ Failed to initialize event bus: %s", exc)

    neo4j_ok = await neo4j_ping()
    if neo4j_ok:
        logger.info("✅ Neo4j connection OK")
        
        # Auto-seed knowledge graph on first startup
        concept_count = await count_concepts()
        if concept_count < 10:
            logger.warning(
                "Knowledge graph has only %d concepts - auto-seeding with universal concepts...",
                concept_count
            )
            try:
                from app.services.concept_seeder import seed_knowledge_graph
                result = await seed_knowledge_graph()
                logger.info(
                    "✅ Knowledge graph seeded: %d concepts, %d relationships",
                    result["concepts_added"],
                    result["relationships_created"]
                )
            except Exception as exc:
                logger.error("Failed to auto-seed knowledge graph: %s", exc)
                logger.info("You can manually seed via: POST /api/demo/seed-knowledge-graph")
        else:
            logger.info("Knowledge graph ready with %d concepts", concept_count)
    else:
        logger.warning("⚠️  Neo4j unreachable — graph features degraded")

    logger.info("=" * 70)
    logger.info("🚀 Entropy AI Engine ready!")
    logger.info("=" * 70)

    yield  # app runs here

    # Shutdown
    logger.info("Shutting down Entropy AI Engine...")
    
    await close_driver()
    logger.info("Neo4j driver closed")
    
    try:
        from app.core.database import disconnect_db
        await disconnect_db()
        logger.info("PostgreSQL disconnected")
    except Exception as exc:
        logger.error("Error disconnecting from PostgreSQL: %s", exc)
    
    try:
        from app.core.cache import cache
        await cache.close()
        logger.info("Redis cache disconnected")
    except Exception as exc:
        logger.warning("Error disconnecting from Redis: %s", exc)
    
    logger.info("Entropy AI Engine stopped.")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Entropy AI Engine",
    description=(
        "Structured Reasoning · Rubric Evaluation · Mastery Tracking · "
        "Knowledge Graph · Multilingual Layer"
    ),
    version="3.0.0",
    lifespan=lifespan,
)

# CORS
cors_origins = settings.get_allowed_origins_list()
if "*" in cors_origins:
    cors_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate Limiting (protect against abuse)
try:
    from app.middleware.rate_limit import RateLimitMiddleware
    app.add_middleware(RateLimitMiddleware)
    logger.info("✅ Rate limiting middleware enabled")
except Exception as exc:
    logger.warning("⚠️  Rate limiting failed to initialize: %s", exc)

# ---------------------------------------------------------------------------
# Route registry helper
# ---------------------------------------------------------------------------
api_router = APIRouter()


def _mount(tag: str, module_path: str, prefix: str):
    """Try to import a route module and register it. Logs full traceback on failure."""
    try:
        import importlib
        mod = importlib.import_module(module_path)
        api_router.include_router(mod.router, prefix=prefix, tags=[tag])
        logger.info("%-20s -> /api%s", tag, prefix)
    except Exception:
        import traceback
        logger.error("%s route FAILED to load:\n%s", tag, traceback.format_exc())


# ---------------------------------------------------------------------------
# Entropy Core Engines  (new)
# ---------------------------------------------------------------------------
_mount("reasoning",      "app.api.routes.reasoning",      "/reasoning")
_mount("evaluation",     "app.api.routes.evaluation",     "/evaluation")
_mount("mastery",        "app.api.routes.mastery",        "/mastery")
_mount("graph",          "app.api.routes.graph",          "/graph")
_mount("gamification",   "app.api.routes.gamification",   "/gamification")

# ---------------------------------------------------------------------------
# Legacy / existing routes  (keep working for frontend)
# ---------------------------------------------------------------------------
_mount("qa",         "app.api.routes.qa",          "/qa")
_mount("documents",  "app.api.routes.documents",   "/documents")
_mount("quiz",       "app.api.routes.quiz",        "/quiz")
_mount("mindmap",    "app.api.routes.mindmap",     "/mindmap")

app.include_router(api_router, prefix="/api")


# ---------------------------------------------------------------------------
# Health & root
# ---------------------------------------------------------------------------
@app.get("/health", tags=["ops"])
async def health():
    neo4j_ok = await neo4j_ping()
    
    # Check PostgreSQL
    postgres_ok = False
    try:
        from app.core.database import health_check
        postgres_ok = await health_check()
    except Exception:
        pass
    
    # Check event bus
    event_bus_ok = False
    handler_count = 0
    try:
        from app.services.events.event_bus import get_event_bus
        bus = get_event_bus()
        event_bus_ok = True
        handler_count = sum(len(handlers) for handlers in bus._handlers.values())
    except Exception:
        pass
    
    return {
        "status": "healthy" if (neo4j_ok and postgres_ok) else "degraded",
        "version": "3.0.0",
        "llm_model": settings.LLM_MODEL,
        "bedrock_region": settings.AWS_REGION,
        "neo4j_connected": neo4j_ok,
        "postgres_connected": postgres_ok,
        "event_bus_active": event_bus_ok,
        "event_handlers": handler_count,
        "loaded_routes": sorted([
            r.path for r in app.routes
            if hasattr(r, "path") and r.path.startswith("/api/")
        ]),
    }


@app.get("/", tags=["ops"])
async def root():
    return {
        "service": "Entropy AI Engine",
        "version": "3.0.0",
        "docs": "/docs",
        "health": "/health",
        "engines": {
            "reasoning":  "/api/reasoning/ask",
            "evaluation": "/api/evaluation/evaluate",
            "mastery":    "/api/mastery/attempt",
            "graph":      "/api/graph/concept",
        },
        "legacy": {
            "qa":         "/api/qa",
            "documents":  "/api/documents",
            "quiz":       "/api/quiz",
            "mindmap":    "/api/mindmap",
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
