"""
Embedding service - thin wrapper over ai_service (local fastembed embeddings).
"""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import List

import numpy as np

from app.services.ai_service import get_ai_service

logger = logging.getLogger(__name__)


class EmbeddingService:
    def __init__(self):
        self._svc = get_ai_service()

    def encode(self, text: str) -> np.ndarray:
        """Embedding for a single text."""
        if not text or not text.strip():
            raise ValueError("Cannot embed empty text string")
        return self._svc.embed(text)

    def encode_batch(self, texts: List[str]) -> np.ndarray:
        """Embeddings for multiple texts, shape (N, dimensions)."""
        if not texts:
            raise ValueError("encode_batch expects a non-empty list")
        return self._svc.embed_batch(texts)

    def similarity(self, text1: str, text2: str) -> float:
        """Cosine similarity between two texts."""
        return self._svc.similarity(text1, text2)


@lru_cache()
def get_embedding_service() -> EmbeddingService:
    return EmbeddingService()
