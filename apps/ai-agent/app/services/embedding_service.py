"""
Embedding Service — delegates to BedrockService (Titan Embeddings V2)
"""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import List

import numpy as np

from app.services.bedrock_service import get_bedrock_service

logger = logging.getLogger(__name__)


class EmbeddingService:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._svc = get_bedrock_service()
        logger.info("EmbeddingService: Titan Embeddings V2 via BedrockService")
        self._initialized = True

    def encode(self, text: str) -> np.ndarray:
        """Generate embedding for a single text string."""
        if not text or not text.strip():
            raise ValueError("Cannot embed empty text string")
        return self._svc.embed(text)

    def encode_batch(self, texts: List[str]) -> np.ndarray:
        """Generate embeddings for multiple texts."""
        if not texts:
            raise ValueError("encode_batch expects a non-empty list")
        return self._svc.embed_batch(texts)

    def similarity(self, text1: str, text2: str) -> float:
        """Cosine similarity between two text embeddings."""
        return self._svc.similarity(text1, text2)


@lru_cache()
def get_embedding_service() -> EmbeddingService:
    return EmbeddingService()


from __future__ import annotations

import json
import logging
import os
import numpy as np
from functools import lru_cache
from typing import List

from app.config import settings

logger = logging.getLogger(__name__)


class EmbeddingService:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        self._init_bedrock()

        self._initialized = True

    # ── Provider init ──────────────────────────────────────────────────────────

    def _init_bedrock(self):
        import boto3
        from botocore.config import Config
        self._model_id = getattr(settings, "BEDROCK_TITAN_EMBED", "amazon.titan-embed-text-v2:0")
        self._bedrock  = boto3.client(
            "bedrock-runtime",
            config=Config(
                region_name=getattr(settings, "AWS_REGION", "ap-northeast-1"),
                retries={"max_attempts": 3},
            ),
        )
        self._provider = "bedrock"
        logger.info("EmbeddingService: Titan Embeddings V2 (%s)", self._model_id)

    def _init_gemini(self):
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise RuntimeError("Missing GOOGLE_API_KEY environment variable.")
        from langchain_google_genai import GoogleGenerativeAIEmbeddings
        model_name = settings.EMBEDDING_MODEL or "models/gemini-embedding-001"
        self.model = GoogleGenerativeAIEmbeddings(model=model_name)
        self._provider = "gemini"
        logger.info("EmbeddingService: Google Gemini Embeddings (%s)", model_name)

    # ── Embedding helpers ──────────────────────────────────────────────────────

    def encode(self, text: str) -> np.ndarray:
        """Generate embedding for a single text string."""
        if not text or not text.strip():
            raise ValueError("Cannot embed empty text string")
        return self._encode_bedrock(text)

    def encode_batch(self, texts: List[str]) -> np.ndarray:
        """Generate embeddings for multiple texts."""
        if not texts:
            raise ValueError("encode_batch expects a non-empty list")
        return np.stack([self._encode_bedrock(t) for t in texts])

    def similarity(self, text1: str, text2: str) -> float:
        """Cosine similarity between two text embeddings."""
        e1 = self.encode(text1)
        e2 = self.encode(text2)
        denom = np.linalg.norm(e1) * np.linalg.norm(e2)
        return float(np.dot(e1, e2) / denom) if denom > 0 else 0.0

    # ── Bedrock internal ──────────────────────────────────────────────────────

    def _encode_bedrock(self, text: str) -> np.ndarray:
        body = json.dumps({"inputText": text, "dimensions": 1536, "normalize": True})
        response = self._bedrock.invoke_model(
            modelId=self._model_id,
            contentType="application/json",
            accept="application/json",
            body=body,
        )
        result = json.loads(response["body"].read())
        return np.array(result["embedding"], dtype=np.float32)


# ── Singleton accessor ─────────────────────────────────────────────────────────

@lru_cache()
def get_embedding_service() -> EmbeddingService:
    return EmbeddingService()
