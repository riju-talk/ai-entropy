"""
Entropy AI — Tavily Internet Search Service

Provides real-time web search to supplement uploaded-document RAG.
Results are injected into the LLM prompt with [1][2] citation markers so the
model can produce answers like NotebookLM / ChatGPT (with live citations).

Set TAVILY_API_KEY in .env to enable.  Free tier: 1 000 requests/month.
https://tavily.com
"""
from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


class TavilySearchService:
    """
    Thin async wrapper around the Tavily AI search API.
    Gracefully degrades to an empty result list when the key is absent.
    """

    def __init__(self) -> None:
        self.api_key: str = os.getenv("TAVILY_API_KEY", "")
        self._client = None
        if self.api_key:
            try:
                from tavily import TavilyClient  # type: ignore[import]
                self._client = TavilyClient(api_key=self.api_key)
                logger.info("Tavily search service initialised")
            except ImportError:
                logger.warning(
                    "tavily-python not installed — internet search disabled. "
                    "Run: pip install tavily-python"
                )
        else:
            logger.info("TAVILY_API_KEY not set — internet search disabled")

    @property
    def available(self) -> bool:
        return self._client is not None

    async def search(
        self,
        query: str,
        max_results: int = 5,
        search_depth: str = "basic",
    ) -> List[Dict[str, Any]]:
        """
        Run a web search and return structured source objects.

        Each object:
            {
                "index":   int,   # 1-based citation number
                "title":   str,
                "url":     str,
                "snippet": str,   # up to 400 chars of content
                "type":    "web",
            }
        """
        if not self._client:
            return []
        try:
            loop = asyncio.get_running_loop()
            raw = await loop.run_in_executor(
                None,
                lambda: self._client.search(
                    query=query,
                    max_results=max_results,
                    search_depth=search_depth,
                    include_answer=False,
                ),
            )
            results: List[Dict[str, Any]] = []
            for i, r in enumerate(raw.get("results", []), start=1):
                snippet = (r.get("content") or r.get("raw_content") or "")[:400].strip()
                results.append(
                    {
                        "index": i,
                        "title": (r.get("title") or "").strip(),
                        "url": (r.get("url") or "").strip(),
                        "snippet": snippet,
                        "type": "web",
                    }
                )
            logger.info("Tavily: %d results for '%s'", len(results), query[:60])
            return results
        except Exception as exc:
            logger.warning("Tavily search failed: %s", exc)
            return []

    def format_for_prompt(self, results: List[Dict[str, Any]]) -> str:
        """
        Format search results as numbered citation blocks for the LLM prompt.

        Instructs the model to reference these as [1], [2], etc. inline and
        to append a ## Sources section at the end of final_solution.
        """
        if not results:
            return ""
        lines = [
            "**Internet Sources — cite inline as [1], [2] … and add a "
            "## Sources section at the end of final_solution:**\n"
        ]
        for r in results:
            lines.append(
                f"[{r['index']}] **{r['title']}**\n"
                f"URL: {r['url']}\n"
                f"Excerpt: {r['snippet']}\n"
            )
        return "\n".join(lines)


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------
_instance: TavilySearchService | None = None


def get_tavily_service() -> TavilySearchService:
    global _instance
    if _instance is None:
        _instance = TavilySearchService()
    return _instance
