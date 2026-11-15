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
    GROQ_MODEL: str = "qwen/qwen3.8-27b"             # tutor answers (any Groq chat model id works)
    GROQ_FAST_MODEL: str = "openai/gpt-oss-20b"      # routing, classification, NLI checks
    GROQ_REASONING_EFFORT: str = "default"           # main model: default | low | medium | high
    GROQ_FAST_REASONING_EFFORT: str = "low"          # fast model (gpt-oss): low | medium | high
    LLM_TEMPERATURE: float = 0.6
    LLM_TOP_P: float = 0.95
    LLM_MAX_TOKENS: int = 2048                       # per generation segment (see LLM_MAX_CONTINUATIONS)
    LLM_MAX_CONTINUATIONS: int = 3                   # extra segments when a reply stops at the token limit
    LLM_TIMEOUT_SECONDS: float = 60.0
    LLM_MAX_RETRIES: int = 3
    LLM_CONTEXT_CHAR_BUDGET: int = 24000             # prompt budget (chars) before history/sources are trimmed

    # -- Tutor harness: tools, MCP, NLI, guardrails ---------------------------
    MCP_SERVER_URLS: str = ""                        # comma-separated MCP (streamable HTTP) endpoints; empty = none
    MCP_TOOL_ALLOWLIST: str = ""                     # comma-separated tool names MCP may expose; empty = none
    MCP_TIMEOUT_SECONDS: float = 8.0
    NLI_ENABLED: bool = True
    NLI_ENTAIL_THRESHOLD: float = 0.6                # a claim counts as supported at/above this entailment confidence
    NLI_CONTRADICT_THRESHOLD: float = 0.5            # a claim counts as contradicted at/above this confidence
    NLI_MIN_SUPPORTED_RATIO: float = 0.5             # below this share of supported claims the answer is qualified
    INPUT_MAX_CHARS: int = 4000

    # -- Rate limiting (see app/middleware/rate_limit.py) ---------------------
    RATE_LIMIT_ENABLED: bool = True
    TUTOR_RATE_PER_MINUTE: int = 12                  # per user, tutor questions
    TUTOR_RATE_PER_HOUR: int = 120
    TUTOR_MAX_CONCURRENT_STREAMS: int = 2            # open answer streams per user
    GLOBAL_LLM_RATE_PER_MINUTE: int = 90             # whole service, protects the Groq quota
    TRUST_PROXY_HEADERS: bool = True                 # use X-Forwarded-For for anonymous callers (Render, Vercel)

    # -- Embeddings (local fastembed, ONNX) -----------------------------------
    EMBEDDING_MODEL: str = "BAAI/bge-small-en-v1.5"
    EMBEDDING_DIMENSIONS: int = 384
    EMBED_THREADS: int = 4                           # ONNX threads for embedding (capped at the CPU count)

    # -- Neo4j knowledge graph (AuraDB Free) ----------------------------------
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_USERNAME: str = ""                         # what the Aura console calls it; wins over NEO4J_USER when set
    NEO4J_PASSWORD: str = ""
    NEO4J_DATABASE: str = ""                         # Aura: same as the instance id; empty = the server's default database

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

    @property
    def neo4j_user(self) -> str:
        return self.NEO4J_USERNAME or self.NEO4J_USER

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
