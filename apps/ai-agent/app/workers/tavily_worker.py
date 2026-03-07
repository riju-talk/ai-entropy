"""
Lambda worker — Tavily internet search

Invoked directly (RequestResponse) by the api Lambda.
Runs in parallel with rag_worker — both finish in max(t_rag, t_tavily)
instead of the previous t_rag + t_tavily.

Event shape:
  { "question": str, "index_offset": int }

Response shape:
  { "web_context": str, "web_sources": list }
"""
import asyncio
import logging

logger = logging.getLogger(__name__)


async def _run(event: dict) -> dict:
    question = event.get("question", "")
    index_offset = int(event.get("index_offset", 0))

    from app.services.tavily_service import get_tavily_service
    svc = get_tavily_service()
    if not svc.available:
        return {"web_context": "", "web_sources": []}

    results = await svc.search(question, max_results=5)
    if not results:
        return {"web_context": "", "web_sources": []}

    # Re-index to avoid clashing with document source numbers
    for r in results:
        r["index"] = r["index"] + index_offset

    web_context = svc.format_for_prompt(results)
    return {"web_context": web_context, "web_sources": results}


def handler(event: dict, context) -> dict:
    """Lambda entry-point."""
    try:
        return asyncio.run(_run(event))
    except Exception as exc:
        logger.error("tavily_worker failed: %s", exc)
        return {"web_context": "", "web_sources": []}
