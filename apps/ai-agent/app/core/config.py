"""
Entropy AI Engine - configuration (the only settings module).

Every value comes from the environment or apps/ai-agent/.env.
External services other than Groq are optional: the app starts without them
and the affected features degrade.
"""
import logging
from pathlib import Path

import dotenv
from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)

AI_AGENT_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE_PATH = AI_AGENT_DIR / ".env"

# .env takes priority over stale system env vars
dotenv.load_dotenv(ENV_FILE_PATH, override=False)


class Settings(BaseSettings):
    # -- LLM (Groq via LangChain) ---------------------------------------------
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "openai/gpt-oss-20b"           # generation, reasoning
    GROQ_FAST_MODEL: str = "openai/gpt-oss-20b"      # routing, classification, verification
    GROQ_REASONING_EFFORT: str = "low"               # low | medium | high (gpt-oss models only)
    LLM_TEMPERATURE: float = 0.3
    LLM_MAX_TOKENS: int = 4096                       # gpt-oss counts hidden reasoning tokens too

    # -- Embeddings (local fastembed, ONNX) -----------------------------------
    EMBEDDING_MODEL: str = "BAAI/bge-small-en-v1.5"
    EMBEDDING_DIMENSIONS: int = 384

    # -- Neo4j knowledge graph (AuraDB Free) ----------------------------------
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = ""

    # -- PostgreSQL (Supabase) ------------------------------------------------
    DATABASE_URL: str = ""

    # -- Redis (optional, e.g. Upstash) ---------------------------------------
    REDIS_HOST: str = ""
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: str = ""

    # -- Pinecone -------------------------------------------------------------
    PINECONE_API_KEY: str = ""
    PINECONE_ENV: str = "us-east-1"
    PINECONE_INDEX_NAME: str = "entropy-ai"
    PINECONE_HOST: str = ""

    # -- Web search (optional) ------------------------------------------------
    TAVILY_API_KEY: str = ""

    # -- Object storage (Supabase Storage, optional) --------------------------
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_KEY: str = ""
    STORAGE_BUCKET: str = "documents"

    # -- Server ---------------------------------------------------------------
    SERVICE_ROLE: str = "all"        # all | tutor | knowledge | studio (see app/roles.py)
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # -- Auth (BFF: only the Next.js server calls this service) ---------------
    AI_BACKEND_TOKEN: str = ""

    # -- CORS -----------------------------------------------------------------
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:5000"

    # -- Text splitting -------------------------------------------------------
    chunk_size: int = 1000
    chunk_overlap: int = 200

    # -- Feature flags --------------------------------------------------------
    ENABLE_PERSISTENCE: bool = True

    def get_allowed_origins_list(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    model_config = {
        "env_file": str(ENV_FILE_PATH),
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
        "extra": "ignore",
    }


settings = Settings()


def validate_settings() -> bool:
    """Log (never raise on) missing configuration."""
    if not settings.GROQ_API_KEY:
        logger.warning("GROQ_API_KEY not set - LLM calls will fail")
    if not settings.AI_BACKEND_TOKEN:
        logger.warning("AI_BACKEND_TOKEN not set - the service will reject all requests")
    if not settings.DATABASE_URL:
        logger.warning("DATABASE_URL not set - database features disabled")
    if not settings.PINECONE_API_KEY:
        logger.warning("PINECONE_API_KEY not set - using the Postgres vector store")
    return True
