from __future__ import annotations

import httpx
import re
from typing import List, Dict, Any

from bs4 import BeautifulSoup
from readability import Document

from app.core.llm import generate_text


# ---------------------------------------
# SEARCH: Bing Web Search API
# ---------------------------------------
async def bing_search(query: str, count: int = 5) -> List[Dict[str, str]]:
    """
    Perform real internet search using Bing Web Search API.
    Requires BING_API_KEY in env.
    """
    import os

    api_key = os.getenv("BING_API_KEY")
    if not api_key:
        raise RuntimeError("Missing BING_API_KEY")

    endpoint = "https://api.bing.microsoft.com/v7.0/search"

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(
            endpoint,
            params={"q": query, "count": count},
            headers={"Ocp-Apim-Subscription-Key": api_key},
        )
        data = resp.json()

    results = []
    for item in data.get("webPages", {}).get("value", []):
        results.append(
            {
                "title": item.get("name"),
                "url": item.get("url"),
                "snippet": item.get("snippet"),
            }
        )

    return results


# ---------------------------------------
# FETCH & CLEAN WEBPAGE CONTENT
# ---------------------------------------
async def fetch_page_text(url: str) -> str:
    """
    Fetch webpage HTML and extract readable text.
    """

    async with httpx.AsyncClient(follow_redirects=True, timeout=20) as client:
        try:
            r = await client.get(url)
            r.raise_for_status()
        except Exception:
            return ""

    try:
        doc = Document(r.text)
        html = doc.summary()
        soup = BeautifulSoup(html, "html.parser")
        text = soup.get_text(separator=" ")
        text = re.sub(r"\s+", " ", text)
        return text.strip()
    except Exception:
        return ""


# ---------------------------------------
# VECTOR STORE INGESTION
# ---------------------------------------
# ---------------------------------------
# COLLECT SEARCH RESULTS AS RAW TEXT
# (no vector-store side-effects — avoids polluting the Pinecone knowledge base)
# ---------------------------------------
async def collect_search_snippets(
    query: str, num_results: int = 5
) -> tuple:
    """
    Search + fetch full pages.  Returns (snippets, results) ready for prompting.
    Falls back to Bing snippets when a page can't be fetched.
    """
    results = await bing_search(query, count=num_results)
    snippets: List[str] = []
    valid_results: List[Dict] = []

    for r in results:
        text = await fetch_page_text(r["url"])
        if text and len(text) >= 200:
            snippets.append(text[:700])
        elif r.get("snippet"):
            snippets.append(r["snippet"])
        else:
            continue
        valid_results.append(r)
        if len(snippets) >= num_results:
            break

    return snippets, valid_results


# ---------------------------------------
# FORMAT FOR ANSWER GENERATION
# ---------------------------------------
def _format_citations(results: List[Dict]) -> List[Dict[str, Any]]:
    return [
        {
            "index": i + 1,
            "source": r.get("url", "unknown"),
            "title": r.get("title", ""),
        }
        for i, r in enumerate(results)
    ]


def _build_prompt(question: str, snippets: List[str], results: List[Dict]) -> str:
    context = []
    for i, (text, r) in enumerate(zip(snippets, results), 1):
        url = r.get("url", "unknown")
        context.append(f"[{i}] {url}\n{text[:800]}")

    return (
        "You are a strict evidence-based researcher.\n"
        "Use ONLY the provided evidence excerpts. Cite using [index].\n"
        "If the evidence is insufficient, clearly say so.\n\n"
        f"Question: {question}\n\n"
        "Evidence:\n" + "\n\n".join(context) + "\n\n"
        "Answer (with citations):"
    )


# ---------------------------------------
# MAIN PIPELINE
# ---------------------------------------
async def internet_research(question: str, k: int = 5, search_results: int = 5) -> Dict[str, Any]:
    """
    Full internet research pipeline:
    1. Search web for topic
    2. Fetch pages + extract readable text
    3. Generate an answer with evidence (no vector-store side-effects)

    Returns: {"answer": str, "citations": list, "sources_used": int}
    """
    snippets, valid_results = await collect_search_snippets(question, num_results=search_results)

    if not snippets:
        return {"answer": "No research results found.", "citations": [], "sources_used": 0}

    prompt = _build_prompt(question, snippets, valid_results)
    answer_text = await generate_text(prompt)

    return {
        "answer": answer_text,
        "citations": _format_citations(valid_results),
        "sources_used": len(snippets),
    }
