"""
Lambda worker — Pinecone RAG retrieval

Invoked directly (RequestResponse) by the api Lambda.
Runs the Pinecone vector search in its own execution environment so it
can run in parallel with the tavily_worker via asyncio.gather.

Event shape:
  { "question": str, "collection": str }

Response shape:
  { "rag_context": str, "sources": list }
"""
import asyncio
import logging

logger = logging.getLogger(__name__)


async def _run(event: dict) -> dict:
    question = event.get("question", "")
    collection = event.get("collection", "default")

    from app.services.agentic_rag_service import AgenticRAGService
    svc = AgenticRAGService()
    rag_context, sources = await svc._retrieve_rag_context(question, collection)
    return {"rag_context": rag_context, "sources": sources}


def handler(event: dict, context) -> dict:
    """Lambda entry-point."""
    try:
        return asyncio.run(_run(event))
    except Exception as exc:
        logger.error("rag_worker failed: %s", exc)
        return {"rag_context": "", "sources": []}
