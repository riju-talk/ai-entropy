"""
NOVYRA AI Engine — Configuration
"""
import os
from pathlib import Path
from pydantic_settings import BaseSettings
import logging

logger = logging.getLogger(__name__)

CONFIG_DIR = Path(__file__).parent
APP_DIR = CONFIG_DIR.parent
AI_AGENT_DIR = APP_DIR.parent
ENV_FILE_PATH = AI_AGENT_DIR / ".env"


class Settings(BaseSettings):
    """NOVYRA application settings"""

    # Google Gemini (primary LLM)
    GOOGLE_API_KEY: str = ""
    LLM_MODEL: str = "gemini-2.0-flash-lite"
    LLM_TEMPERATURE: float = 0.3

    # Neo4j Knowledge Graph
    NEO4J_URI: str = "bolt://neo4j:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "novyra_neo4j"

    # PostgreSQL
    DATABASE_URL: str = ""

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Auth
    AI_BACKEND_TOKEN: str = ""
    SECRET_KEY: str = "novyra-secret-change-in-prod"

    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:5000"

    # Upload storage
    UPLOAD_DIR: str = "/app/data/uploads"

    # Debug
    DEBUG: bool = False

    # Pinecone (optional - for legacy quiz/mindmap/documents routes)
    PINECONE_API_KEY: str = ""
    PINECONE_ENV: str = "us-east-1"
    PINECONE_INDEX_NAME: str = "novyra-ai"

    # LangChain extras (optional)
    GROQ_API_KEY: str = ""
    EMBEDDING_MODEL: str = "models/embedding-001"

    # Text splitting (used by LangChain service)
    chunk_size: int = 1000
    chunk_overlap: int = 200

    # Persistence / storage (enables document upload to vector store)
    ENABLE_PERSISTENCE: bool = True

    def get_allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    class Config:
        env_file = str(ENV_FILE_PATH)
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "ignore"


settings = Settings()
logger.info("NOVYRA config loaded | LLM: %s | Neo4j: %s", settings.LLM_MODEL, settings.NEO4J_URI)


def validate_settings():
    issues = []
    if not settings.GOOGLE_API_KEY:
        issues.append("GOOGLE_API_KEY not set — LLM calls will fail")
    if not settings.DATABASE_URL:
        issues.append("DATABASE_URL not set — DB features disabled")
    for issue in issues:
        logger.warning("⚠️  %s", issue)
    return True

