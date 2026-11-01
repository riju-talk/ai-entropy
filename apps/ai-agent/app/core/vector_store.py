"""
Vector store behind one small interface.

  Pinecone  when PINECONE_API_KEY is set (serverless index, one namespace per user/collection)
  Postgres  otherwise (doc_chunks table, cosine similarity in numpy)

The Postgres backend keeps document Q&A working with zero extra services, which is what the Docker
demo uses. A Pinecone backend that fails at runtime degrades to Postgres instead of breaking answers.
Embeddings always come from the local fastembed model, so both backends use identical vectors.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Any, Dict, List, Optional

import numpy as np

from app.core.config import settings

logger = logging.getLogger(__name__)

_MAX_LOCAL_ROWS = 4000  # newest chunks scanned per namespace by the Postgres backend


async def _embed(texts: List[str]) -> np.ndarray:
    from app.services.ai_service import get_ai_service

    return await asyncio.to_thread(get_ai_service().embed_batch, texts)


class VectorStore:
    def __init__(self) -> None:
        self._index: Any = None
        self._pinecone_failed = False

    # -- backend selection ---------------------------------------------------------------------

    @property
    def backend(self) -> str:
        return "pinecone" if (settings.PINECONE_API_KEY and not self._pinecone_failed) else "postgres"

    def _pinecone_index(self):
        if self._index is None:
            from pinecone import Pinecone, ServerlessSpec

            pc = Pinecone(api_key=settings.PINECONE_API_KEY)
            if settings.PINECONE_HOST:
                self._index = pc.Index(host=settings.PINECONE_HOST)
            else:
                name = settings.PINECONE_INDEX_NAME
                existing = {i["name"] for i in pc.list_indexes()}
                if name not in existing:
                    logger.info("Creating Pinecone index %s (dim=%d)", name, settings.EMBEDDING_DIMENSIONS)
                    pc.create_index(
                        name=name,
                        dimension=settings.EMBEDDING_DIMENSIONS,
                        metric="cosine",
                        spec=ServerlessSpec(cloud="aws", region=settings.PINECONE_ENV),
                    )
                self._index = pc.Index(name)
        return self._index

    def _degrade(self, exc: Exception) -> None:
        logger.warning("Pinecone unavailable (%s); using the Postgres vector store", exc)
        self._pinecone_failed = True

    # -- API -----------------------------------------------------------------------------------

    async def upsert(self, namespace: str, texts: List[str], metadatas: List[Dict[str, Any]]) -> int:
        """Embed and store chunks. Returns how many were stored."""
        texts = [t for t in texts if t and t.strip()]
        if not texts:
            return 0
        vectors = await _embed(texts)
        if self.backend == "pinecone":
            try:
                await asyncio.to_thread(self._pinecone_upsert, namespace, texts, metadatas, vectors)
                return len(texts)
            except Exception as exc:
                self._degrade(exc)
        return await self._pg_upsert(namespace, texts, metadatas, vectors)

    async def query(self, namespace: str, text: str, k: int = 6) -> List[Dict[str, Any]]:
        """Top-k chunks for `text`: [{text, source, score, metadata}], best first."""
        if not text.strip():
            return []
        qv = (await _embed([text]))[0]
        if self.backend == "pinecone":
            try:
                return await asyncio.to_thread(self._pinecone_query, namespace, qv, k)
            except Exception as exc:
                self._degrade(exc)
        return await self._pg_query(namespace, qv, k)

    async def delete_source(self, namespace: str, source: str) -> None:
        if self.backend == "pinecone":
            try:
                await asyncio.to_thread(lambda: self._pinecone_index().delete(filter={"source": source}, namespace=namespace))
            except Exception as exc:
                self._degrade(exc)
        from app.core.database import get_db

        try:
            await get_db().docchunk.delete_many(where={"namespace": namespace, "source": source})
        except Exception as exc:
            logger.warning("Could not delete local chunks for %s: %s", source, exc)

    async def stats(self) -> Dict[str, Any]:
        if self.backend == "pinecone":
            try:
                s = await asyncio.to_thread(lambda: self._pinecone_index().describe_index_stats())
                return {"backend": "pinecone", "total_vectors": s.get("total_vector_count", 0), "namespaces": list((s.get("namespaces") or {}).keys())}
            except Exception as exc:
                self._degrade(exc)
        from app.core.database import get_db

        try:
            db = get_db()
            total = await db.docchunk.count()
            rows = await db.query_raw('SELECT DISTINCT "namespace" FROM "doc_chunks"')
            return {"backend": "postgres", "total_vectors": total, "namespaces": [r["namespace"] for r in rows]}
        except Exception as exc:
            return {"backend": "postgres", "total_vectors": 0, "namespaces": [], "error": str(exc)}

    # -- Pinecone ------------------------------------------------------------------------------

    def _pinecone_upsert(self, namespace, texts, metadatas, vectors) -> None:
        ok = (str, int, float, bool)  # Pinecone metadata value types
        records = []
        for text, meta, vec in zip(texts, metadatas, vectors):
            md = {k: v for k, v in (meta or {}).items() if isinstance(v, ok)}
            md["text"] = text[:2000]
            records.append({"id": str(uuid.uuid4()), "values": vec.tolist(), "metadata": md})
        index = self._pinecone_index()
        for i in range(0, len(records), 100):
            index.upsert(vectors=records[i : i + 100], namespace=namespace)

    def _pinecone_query(self, namespace, qv, k) -> List[Dict[str, Any]]:
        res = self._pinecone_index().query(vector=qv.tolist(), top_k=k, namespace=namespace, include_metadata=True)
        out = []
        for m in res.get("matches", []):
            md = dict(m.get("metadata") or {})
            out.append({"text": md.pop("text", ""), "source": md.get("source", ""), "score": float(m.get("score", 0)), "metadata": md})
        return out

    # -- Postgres ------------------------------------------------------------------------------

    async def _pg_upsert(self, namespace, texts, metadatas, vectors) -> int:
        from prisma import Json

        from app.core.database import get_db

        db = get_db()
        sources = {str((m or {}).get("source") or "unknown") for m in metadatas}
        await db.docchunk.delete_many(where={"namespace": namespace, "source": {"in": list(sources)}})  # re-upload replaces
        rows = [
            {
                "namespace": namespace,
                "source": str((meta or {}).get("source") or "unknown"),
                "content": text,
                "metadata": Json(meta or {}),
                "embedding": Json([round(float(x), 5) for x in vec]),
            }
            for text, meta, vec in zip(texts, metadatas, vectors)
        ]
        for i in range(0, len(rows), 200):
            await db.docchunk.create_many(data=rows[i : i + 200])
        return len(rows)

    async def _pg_query(self, namespace, qv, k) -> List[Dict[str, Any]]:
        from app.core.database import get_db

        rows = await get_db().docchunk.find_many(where={"namespace": namespace}, order={"createdAt": "desc"}, take=_MAX_LOCAL_ROWS)
        if not rows:
            return []
        mat = np.array([r.embedding for r in rows], dtype=np.float32)
        norms = np.linalg.norm(mat, axis=1) * (np.linalg.norm(qv) or 1.0)
        sims = (mat @ qv) / np.where(norms == 0, 1.0, norms)
        top = np.argsort(-sims)[:k]
        return [
            {"text": rows[i].content, "source": rows[i].source, "score": float(sims[i]), "metadata": rows[i].metadata or {}}
            for i in top
        ]


_store: Optional[VectorStore] = None


def get_vector_store() -> VectorStore:
    global _store
    if _store is None:
        _store = VectorStore()
    return _store
