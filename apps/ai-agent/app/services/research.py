from __future__ import annotations

import httpx
import re
from typing import List, Dict, Any

from bs4 import BeautifulSoup
from readability import Document

from app.core.vector_store import get_vector_store
from app.core.llm import get_llm


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
async def ingest_search_results(query: str, num_results: int = 5) -> List[Dict[str, Any]]:
    """
    Search the internet, fetch page text, chunk it, insert into vector DB.
    Returns docs with metadata for RAG.
    """
    vector_store = get_vector_store()
    results = await bing_search(query, num_results)

    docs = []

    for r in results:
        url = r["url"]
        text = await fetch_page_text(url)
        if not text or len(text) < 200:
            continue

        # Chunk text (simple strategy)
        chunk_size = 700
        chunks = [text[i:i+chunk_size] for i in range(0, len(text), chunk_size)]

        for c in chunks:
            meta = {
                "source": url,
                "title": r["title"],
                "snippet": r["snippet"],
            }
            docs.append({"page_content": c, "metadata": meta})

    # Add to vector DB
    texts = [d["page_content"] for d in docs]
    metas = [d["metadata"] for d in docs]
    vector_store.add_texts(texts=texts, metadatas=metas)

    return docs


# ---------------------------------------
# FORMAT FOR ANSWER GENERATION
# ---------------------------------------
def _format_citations(docs: List[Any]) -> List[Dict[str, Any]]:
    citations = []
    for i, d in enumerate(docs):
        meta = d.metadata
        citations.append(
            {
                "index": i + 1,
                "source": meta.get("source", "unknown"),
                "title": meta.get("title", ""),
            }
        )
    return citations


def _build_prompt(question: str, docs: List[Any]) -> str:
    context = []
    for i, d in enumerate(docs, 1):
        text = d.page_content[:800]
        meta = d.metadata
        url = meta.get("source", "unknown")

        context.append(
            f"[{i}] {url}\n{text}"
        )

    return (
        "You are a strict evidence-based researcher.\n"
        "Use ONLY the provided evidence excerpts. Cite using [index].\n"
        "If the evidence is insufficient, clearly say so.\n\n"
        f"Question: {question}\n\n"
        f"Evidence:\n" + "\n\n".join(context) + "\n\n"
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
    3. Insert into vector store
    4. Retrieve relevant chunks
    5. LLM answers with citations
    """

    # Step 1–3: Search internet & ingest results
    await ingest_search_results(question, num_results=search_results)

    # Step 4: Retrieve chunks
    vector_store = get_vector_store()
    docs = vector_store.similarity_search(question, k=k)

    # Step 5: Build prompt + generate answer
    prompt = _build_prompt(question, docs)
    llm = get_llm()
    result = llm.invoke(prompt)

    answer_text = getattr(result, "content", None) or str(result)

    return {
        "answer": answer_text,
        "citations": _format_citations(docs),
    }
