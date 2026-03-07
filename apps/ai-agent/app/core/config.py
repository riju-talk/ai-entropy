"""
Entropy AI Engine â€” Configuration
"""
import os
from pathlib import Path
from pydantic_settings import BaseSettings
import logging
import dotenv


logger = logging.getLogger(__name__)


CONFIG_DIR = Path(__file__).parent
APP_DIR = CONFIG_DIR.parent
AI_AGENT_DIR = APP_DIR.parent
ENV_FILE_PATH = AI_AGENT_DIR / ".env"

dotenv.load_dotenv(ENV_FILE_PATH, override=True)  # .env takes priority over stale system env vars

class Settings(BaseSettings):
    """Entropy AI Engine application settings — all values loaded from .env"""

    # ── Google Gemini ────────────────────────────────────────────────────────
    AWS_REGION: str = "eu-north-1"
    BEDROCK_CLAUDE_MODEL: str = "anthropic.claude-3-sonnet-20240229-v1:0"
    BEDROCK_TITAN_EMBED: str = "amazon.titan-embed-text-v2:0"
    LLM_MODEL: str = "anthropic.claude-3-sonnet-20240229-v1:0"
    LLM_TEMPERATURE: float = 0.3

    # ── AI Provider ──────────────────────────────────────────────────────────
    AI_PROVIDER: str = "bedrock"

    # ── Neo4j Knowledge Graph ────────────────────────────────────────────────
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "entropy123"

    # ── PostgreSQL ───────────────────────────────────────────────────────────
    DATABASE_URL: str = ""

    # ── Redis ────────────────────────────────────────────────────────────────
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379

    # ── Server ───────────────────────────────────────────────────────────────
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # ── Auth ─────────────────────────────────────────────────────────────────
    AI_BACKEND_TOKEN: str = ""
    JWT_SECRET_KEY: str = "entropy-jwt-secret-dev"
    SECRET_KEY: str = "entropy-secret-change-in-prod"

    # ── CORS ─────────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:5000"

    # ── S3 Document Storage ──────────────────────────────────────────────────
    S3_BUCKET_NAME: str = "entropy-doc-main"
    S3_PRESIGN_EXPIRY_SECS: int = 3600

    # ── Upload storage ───────────────────────────────────────────────────────
    UPLOAD_DIR: str = "data/uploads"

    # ── Debug ────────────────────────────────────────────────────────────────
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # ── Pinecone ─────────────────────────────────────────────────────────────
    VECTOR_DB: str = "pinecone"
    PINECONE_API_KEY: str = ""
    PINECONE_ENV: str = "us-east-1"
    PINECONE_INDEX_NAME: str = "entropy-ai"
    PINECONE_HOST: str = ""

    # ── Embeddings ───────────────────────────────────────────────────────────
    EMBEDDING_MODEL: str = "amazon.titan-embed-text-v2:0"
    EMBEDDING_DIMENSIONS: int = 1536

    # ── LangChain text splitting ─────────────────────────────────────────────
    chunk_size: int = 1000
    chunk_overlap: int = 200

    # ── Feature flags ────────────────────────────────────────────────────────
    ENABLE_PERSISTENCE: bool = True

    def get_allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    model_config = {
        "env_file": str(ENV_FILE_PATH),
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
        "extra": "ignore",
    }


settings = Settings()
logger.info("Entropy AI config loaded | LLM: %s | Neo4j: %s", settings.LLM_MODEL, settings.NEO4J_URI)


def validate_settings():
    issues = []
    if not settings.AWS_REGION:
        issues.append("AWS_REGION not set — Bedrock calls may fail")
    if not settings.DATABASE_URL:
        issues.append("DATABASE_URL not set â€” DB features disabled")
    for issue in issues:
        logger.warning("âš ï¸  %s", issue)
    return True

