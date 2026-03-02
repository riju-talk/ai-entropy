"""
Embedding Service
Google Gemini Embeddings Only
"""

from __future__ import annotations

import os
import numpy as np
from functools import lru_cache
from typing import List

from langchain_google_genai import GoogleGenerativeAIEmbeddings
from app.config import settings
from app.utils.logger import setup_logger

logger = setup_logger(__name__)


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

        # Load API key from environment
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise RuntimeError(
                "Missing GOOGLE_API_KEY environment variable. "
                "Set it in your .env file."
            )

        model_name = settings.EMBEDDING_MODEL or "models/gemini-embedding-001"
        logger.info(f"Loading Google Gemini Embedding Model: {model_name}")

        # Initialize Gemini embeddings
        self.model = GoogleGenerativeAIEmbeddings(model=model_name)

        self._initialized = True
        logger.info("Google Gemini embedding model loaded successfully")

    # ----------------------------------------------------
    # Embedding helpers
    # ----------------------------------------------------

    def encode(self, text: str) -> np.ndarray:
        """Generate embedding for a single text string."""
        if not text or not text.strip():
            raise ValueError("Cannot embed empty text string")
        emb = self.model.embed_query(text)
        return np.array(emb, dtype=np.float32)

    def encode_batch(self, texts: List[str]) -> np.ndarray:
        """Generate embeddings for multiple texts."""
        if not texts or not isinstance(texts, list):
            raise ValueError("encode_batch expects a non-empty list")
        embeddings = self.model.embed_documents(texts)
        return np.array(embeddings, dtype=np.float32)

    def similarity(self, text1: str, text2: str) -> float:
        """Cosine similarity between two text embeddings."""
        e1 = self.encode(text1)
        e2 = self.encode(text2)

        denom = np.linalg.norm(e1) * np.linalg.norm(e2)
        if denom == 0:
            return 0.0

        return float(np.dot(e1, e2) / denom)


# ----------------------------------------------------
# Singleton accessor
# ----------------------------------------------------
@lru_cache()
def get_embedding_service() -> EmbeddingService:
    return EmbeddingService()
