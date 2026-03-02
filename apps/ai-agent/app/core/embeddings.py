"""
Embeddings Service
Provides embedding models and configuration
"""

from typing import List, Optional
from app.utils.logger import setup_logger

logger = setup_logger(__name__)

_embeddings_instance = None

class EmbeddingService:
    def __init__(self):
        self._embeddings = None
    
    def _get_embeddings(self):
        """Lazy load embeddings model"""
        # GPT4All support has been removed to avoid local dependency issues.
        # Always use the lightweight fallback embedding implementation.
        if self._embeddings is None:
            logger.info("⚠️ GPT4All disabled: using fallback embeddings (deterministic hash-based)")
            self._embeddings = "fallback"
        return self._embeddings
    
    async def embed_text(self, text: str) -> List[float]:
        """Embed a single text"""
        embeddings = self._get_embeddings()
        if embeddings == "fallback":
            return self._simple_embed(text)
        
        try:
            return embeddings.embed(text)
        except Exception as e:
            logger.warning(f"Embedding error: {e}, using fallback")
            return self._simple_embed(text)
    
    async def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Embed multiple documents"""
        return [await self.embed_text(text) for text in texts]
    
    def _simple_embed(self, text: str) -> List[float]:
        """Fallback simple embedding"""
        import hashlib
        hash_obj = hashlib.md5(text.encode())
        hash_bytes = hash_obj.digest()
        embedding = []
        for _ in range(24):
            embedding.extend([float(b) / 255.0 for b in hash_bytes])
        return embedding[:384]

def get_embedding_service():
    """Get singleton embedding service"""
    global _embeddings_instance
    if _embeddings_instance is None:
        _embeddings_instance = EmbeddingService()
    return _embeddings_instance
