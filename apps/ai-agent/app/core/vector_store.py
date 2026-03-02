"""
Vector Store using ChromaDB (FREE and local) - NO HUGGINGFACE
"""

import chromadb
from chromadb.config import Settings as ChromaSettings
from typing import List, Dict, Optional
from pathlib import Path

from app.config import settings
from app.core.embeddings import get_embedding_service
from app.utils.logger import setup_logger

logger = setup_logger(__name__)

_vector_store_instance = None

class VectorStoreService:
    def __init__(self):
        # Create data directory
        data_dir = Path(settings.CHROMA_PERSIST_DIR)
        data_dir.mkdir(parents=True, exist_ok=True)
        
        try:
            self.client = chromadb.PersistentClient(
                path=str(data_dir),
                settings=ChromaSettings(
                    anonymized_telemetry=False,
                    allow_reset=True
                )
            )
            logger.info(f"✅ ChromaDB initialized at {data_dir}")
        except Exception as e:
            logger.warning(f"ChromaDB initialization error: {e}, using in-memory")
            self.client = chromadb.Client()
        
        self.embedding_service = get_embedding_service()
    
    def get_or_create_collection(self, name: str):
        """Get or create a collection"""
        try:
            return self.client.get_or_create_collection(
                name=name,
                metadata={"hnsw:space": "cosine"}
            )
        except Exception:
            return self.client.get_or_create_collection(name=name)
    
    async def add_documents(
        self,
        collection_name: str,
        texts: List[str],
        metadatas: Optional[List[Dict]] = None,
        ids: Optional[List[str]] = None
    ):
        """Add documents to collection"""
        if not texts:
            return
        
        collection = self.get_or_create_collection(collection_name)
        embeddings = await self.embedding_service.embed_documents(texts)
        
        if not ids:
            ids = [f"doc_{i}" for i in range(len(texts))]
        
        if not metadatas:
            metadatas = [{}] * len(texts)
        
        try:
            collection.add(
                embeddings=embeddings,
                documents=texts,
                metadatas=metadatas,
                ids=ids
            )
        except Exception as e:
            logger.error(f"Add documents error: {e}")
            raise
    
    async def query_documents(
        self,
        collection_name: str,
        query_text: str,
        n_results: int = 3
    ) -> List[Dict]:
        """Query documents from collection"""
        try:
            collection = self.get_or_create_collection(collection_name)
            query_embedding = await self.embedding_service.embed_text(query_text)
            
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=min(n_results, collection.count() or 1)
            )
            
            documents = []
            if results["documents"] and results["documents"][0]:
                for i, doc in enumerate(results["documents"][0]):
                    documents.append({
                        "content": doc,
                        "metadata": results["metadatas"][0][i] if results.get("metadatas") and results["metadatas"][0] else {},
                        "distance": results["distances"][0][i] if results.get("distances") and results["distances"][0] else 0
                    })
            
            return documents
        except Exception as e:
            logger.error(f"Query error: {e}")
            return []
    
    def delete_collection(self, name: str):
        """Delete a collection"""
        try:
            self.client.delete_collection(name)
        except Exception as e:
            logger.warning(f"Delete collection error: {e}")

def get_vector_store():
    """Get singleton vector store"""
    global _vector_store_instance
    if _vector_store_instance is None:
        _vector_store_instance = VectorStoreService()
    return _vector_store_instance

# For backward compatibility with old code
def init_vector_store():
    """Initialize vector store (called on startup)"""
    return get_vector_store()
