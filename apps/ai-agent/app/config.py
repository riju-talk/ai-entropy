"""
Configuration management for Entropy AI Agent
"""
import os
from pathlib import Path
from dotenv import load_dotenv
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional, Union

# Load environment variables from multiple locations
env_paths = [
    Path(".env.local"),
    Path(".env"),
    Path("../../.env"),  # Root monorepo .env
]

for env_path in env_paths:
    if env_path.exists():
        load_dotenv(env_path, override=False)
        break


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Application
    APP_NAME: str = "Entropy AI Agent"
    APP_VERSION: str = "3.0.0"
    DEBUG: bool = True

    # API Configuration
    AI_BACKEND_TOKEN: Optional[str] = None
    BACKEND_URL: str = "http://localhost:3000"

    # Google Gemini API (Legacy — kept for fallback compatibility)
    GOOGLE_API_KEY: Optional[str] = None

    # Pinecone API (Legacy — kept for fallback compatibility)
    PINECONE_API_KEY: Optional[str] = None
    PINECONE_ENV: str = "us-east-1"
    PINECONE_INDEX_NAME: str = "entropy-ai"

    # ── AWS Configuration ─────────────────────────────────────────────────────
    AWS_REGION: str = "us-east-1"
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None

    # Amazon Bedrock — Claude 3 Sonnet
    BEDROCK_CLAUDE_MODEL: str = "anthropic.claude-3-sonnet-20240229-v1:0"
    BEDROCK_TITAN_EMBED: str = "amazon.titan-embed-text-v2:0"

    # S3 Document Store
    S3_BUCKET_NAME: str = "entropy-documents"
    S3_PRESIGN_EXPIRY_SECS: int = 3600

    # AI Provider: "bedrock" | "gemini"
    # Set to "bedrock" for AWS deployment.
    AI_PROVIDER: str = os.getenv("AI_PROVIDER", "bedrock")

    # LLM Configuration
    LLM_MODEL: str = os.getenv("LLM_MODEL", "anthropic.claude-3-sonnet-20240229-v1:0")
    LLM_TEMPERATURE: float = 0.7
    LLM_MAX_TOKENS: int = 2048

    # Server Configuration
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Embedding Model (Bedrock Titan by default; Gemini fallback)
    EMBEDDING_MODEL: str = "amazon.titan-embed-text-v2:0"

    # Vector Store (local Chroma for dev; PostgreSQL pgvector in prod)
    CHROMA_PERSIST_DIR: str = "./data/chroma_db"

    # File Upload
    UPLOAD_DIR: str = "./data/uploads"
    MAX_UPLOAD_SIZE: int = 10485760  # 10MB in bytes
    ALLOWED_FILE_TYPES: Union[List[str], str] = [".pdf", ".txt", ".doc", ".docx"]

    # ── PostgreSQL / Prisma Configuration ─────────────────────────────────────
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://localhost:5432/entropy")
    DIRECT_URL: str = os.getenv("DIRECT_URL", "postgresql://localhost:5432/entropy")

    # ── Neo4j Configuration ───────────────────────────────────────────────────
    NEO4J_URI: str = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    NEO4J_USER: str = os.getenv("NEO4J_USER", "neo4j")
    NEO4J_PASSWORD: str = os.getenv("NEO4J_PASSWORD", "password")

    # ── Redis Configuration ───────────────────────────────────────────────────
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_DB: int = int(os.getenv("REDIS_DB", "0"))
    REDIS_PASSWORD: Optional[str] = os.getenv("REDIS_PASSWORD")

    # ── JWT Configuration ─────────────────────────────────────────────────────
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # ── Lambda / SQS Configuration ────────────────────────────────────────────
    # Set IS_LAMBDA=true in Lambda environment to enable parallel fan-out and
    # SQS async dispatch. Leave unset (false) for local dev — falls back to
    # in-process execution so no AWS credentials are needed locally.
    IS_LAMBDA: bool = os.getenv("IS_LAMBDA", "false").lower() == "true"
    LAMBDA_FUNCTION_PREFIX: str = os.getenv("LAMBDA_FUNCTION_PREFIX", "entropy-ai-engine-dev")
    MASTERY_QUEUE_URL: Optional[str] = os.getenv("MASTERY_QUEUE_URL")
    GAMIFICATION_QUEUE_URL: Optional[str] = os.getenv("GAMIFICATION_QUEUE_URL")
    RAG_WORKER_FUNCTION: Optional[str] = os.getenv("RAG_WORKER_FUNCTION")
    TAVILY_WORKER_FUNCTION: Optional[str] = os.getenv("TAVILY_WORKER_FUNCTION")

    # Tavily
    TAVILY_API_KEY: Optional[str] = os.getenv("TAVILY_API_KEY")

    # ── CORS Configuration ────────────────────────────────────────────────────
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://entropy.ai",
        "https://www.entropy.ai",
    ]

    # ── Rate Limiting ─────────────────────────────────────────────────────────
    RATE_LIMIT_WINDOW: int = 60  # seconds
    RATE_LIMIT_MAX_REQUESTS: int = 100

    # ── Document Processing ───────────────────────────────────────────────────
    ENABLE_PERSISTENCE: bool = os.getenv("ENABLE_PERSISTENCE", "true").lower() == "true"

    # ── Logging ───────────────────────────────────────────────────────────────
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_FORMAT: str = "json"  # "json" or "text"

    @field_validator("ALLOWED_FILE_TYPES", mode="before")
    @classmethod
    def parse_file_types(cls, v):
        if isinstance(v, str):
            return [f.strip() for f in v.split(",")]
        return v

    def get_allowed_origins_list(self) -> List[str]:
        """Get list of allowed CORS origins"""
        return self.CORS_ORIGINS


settings = Settings()


def validate_settings() -> None:
    """Validate required configuration values"""
    errors = []
    
    if not settings.AI_BACKEND_TOKEN:
        errors.append("AI_BACKEND_TOKEN is required for production")
    
    if settings.AI_PROVIDER == "bedrock":
        if not settings.AWS_ACCESS_KEY_ID:
            errors.append("AWS_ACCESS_KEY_ID is required when AI_PROVIDER=bedrock")
        if not settings.AWS_SECRET_ACCESS_KEY:
            errors.append("AWS_SECRET_ACCESS_KEY is required when AI_PROVIDER=bedrock")
    
    if errors:
        error_msg = "Configuration errors:\n" + "\n".join(f"  - {e}" for e in errors)
        raise ValueError(error_msg)
    
    logger = __import__("logging").getLogger(__name__)
    logger.info("Configuration validated successfully")
