"""
Configuration management for Spark AI Agent
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from typing import List, Optional, Union
import os
from pathlib import Path
from dotenv import load_dotenv

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
    # Application
    APP_NAME: str = "Entropy AI Agent"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # API Configuration
    AI_BACKEND_TOKEN: Optional[str] = None
    AI_BACKEND_URL: str = "http://localhost:3000"

    # Groq API (Legacy/Fallback)
    GROQ_API_KEY: Optional[str] = None

    # Google Gemini API (Primary)
    GOOGLE_API_KEY: Optional[str] = None

    # Pinecone API
    PINECONE_API_KEY: Optional[str] = None
    PINECONE_ENV: str = "us-east-1" # default, can be overridden
    PINECONE_INDEX_NAME: str = "spark-ai"

    # LLM Configuration
    # LLM Configuration
    LLM_MODEL: str = os.getenv("LLM_MODEL", "gemini-1.5-flash")
    LLM_TEMPERATURE: float = 0.7
    LLM_MAX_TOKENS: int = 2000

    # Server Configuration
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Embedding Model
    EMBEDDING_MODEL: str = "models/embedding-001"

    # Vector Store
    CHROMA_PERSIST_DIR: str = "./data/chroma_db"

    # File Upload
    UPLOAD_DIR: str = "./data/uploads"
    MAX_UPLOAD_SIZE: int = 10485760  # 10MB in bytes
    ALLOWED_FILE_TYPES: Union[List[str], str] = [".pdf", ".txt", ".doc", ".docx"]

    # CORS - can be string or list
    ALLOWED_ORIGINS: Union[List[str], str] = ["http://localhost:3000", "http://localhost:5000"]

    # Credit Costs
    CHAT_SHORT_COST: float = 1.0
    CHAT_LONG_COST: float = 2.0
    FLASHCARD_COST: float = 3.0
    QUIZ_COST: float = 4.0
    MINDMAP_COST: float = 2.5

    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 30
    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 200

    # Persistence toggle: set to true to enable creating data dirs and saving history
    ENABLE_PERSISTENCE: bool = False

    @field_validator('ALLOWED_FILE_TYPES', mode='before')
    @classmethod
    def parse_file_types(cls, v):
        """Parse ALLOWED_FILE_TYPES from various formats"""
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            if not v or v.strip() == '':
                return [".pdf", ".txt", ".doc", ".docx"]
            # Try JSON first
            if v.startswith('['):
                try:
                    import json
                    return json.loads(v)
                except:
                    pass
            # Comma-separated
            return [ext.strip() for ext in v.split(',') if ext.strip()]
        return [".pdf", ".txt", ".doc", ".docx"]

    @field_validator('ALLOWED_ORIGINS', mode='before')
    @classmethod
    def parse_origins(cls, v):
        """Parse ALLOWED_ORIGINS from various formats"""
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            if not v or v.strip() == '':
                return ["http://localhost:3000", "http://localhost:5000"]
            # Try JSON first
            if v.startswith('['):
                try:
                    import json
                    return json.loads(v)
                except:
                    pass
            # Comma-separated
            return [origin.strip() for origin in v.split(',') if origin.strip()]
        return ["http://localhost:3000", "http://localhost:5000"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding='utf-8',
        case_sensitive=True,
        extra='ignore'  # Ignore extra env vars
    )

settings = Settings()

# Create necessary directories only if persistence is explicitly enabled.
# Default is disabled to avoid creating local data dirs in ephemeral/serverless environments.
if getattr(settings, 'ENABLE_PERSISTENCE', False):
    os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
