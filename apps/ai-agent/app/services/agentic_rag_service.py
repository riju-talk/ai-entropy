"""
Entropy AI — Agentic RAG Orchestrator

Master pipeline:
  1. Pinecone RAG retrieval (uploaded documents / knowledge base)
  2. Optional internet research (if BING_API_KEY is set)
  3. 7-layer AI Brain (Layers 1–6) with injected RAG context
  4. NLI validation (Layer 7)  — executed inside reasoning_engine
  5. Trust scoring  (Layer 8)  — executed inside reasoning_engine

Returns a rich, structured response consumed by the QA endpoint.
"""
import logging
import os
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


class AgenticRAGService:
    """Master pipeline: Pinecone RAG → AI Brain → NLI judge → enriched answer."""

    def __init__(self):
        from app.services.langchain_service import langchain_service
        if not langchain_service:
            raise RuntimeError("LangChain service not available")
        self.langchain = langchain_service
        logger.info("✅ Agentic RAG service initialized")

    # ------------------------------------------------------------------
    # Step 1 — Pinecone RAG retrieval
    # ------------------------------------------------------------------
    async def _retrieve_rag_context(
        self,
        question: str,
        collection_name: str = "default",
        k: int = 6,
    ) -> tuple:
        """Return (rag_context_str, sources_list) from Pinecone."""
        try:
            vector_store = self.langchain.load_vector_store(collection_name)
            if not vector_store:
                logger.info("No vector store found for collection: %s", collection_name)
                return "", []

            docs = vector_store.similarity_search(question, k=k)
            if not docs:
                return "", []

            rag_context = "\n\n---\n\n".join(
                f"[Source {i + 1}]\n{doc.page_content}"
                for i, doc in enumerate(docs)
            )
            sources = [
                {
                    "content": doc.page_content[:300] + ("..." if len(doc.page_content) > 300 else ""),
                    "metadata": doc.metadata,
                }
                for doc in docs
            ]
            logger.info("✅ Retrieved %d RAG chunks from Pinecone", len(docs))
            return rag_context, sources
        except Exception as exc:
            logger.warning("RAG retrieval failed: %s", exc)
            return "", []

    # ------------------------------------------------------------------
    # Step 2 — Optional internet research
    # ------------------------------------------------------------------
    async def _try_internet_research(self, question: str) -> tuple:
        """Run internet research if BING_API_KEY is configured."""
        if not os.getenv("BING_API_KEY"):
            return "", []
        try:
            from app.services.research import internet_research
            result = await internet_research(question)
            answer = result.get("answer", "")
            citations = result.get("citations", [])
            sources = [
                {
                    "content": c.get("title", ""),
                    "metadata": {"source": c.get("source", ""), "index": c.get("index")},
                }
                for c in citations
            ]
            logger.info("✅ Internet research complete: %d citations", len(citations))
            return answer, sources
        except Exception as exc:
            logger.warning("Internet research failed: %s", exc)
            return "", []

    # ------------------------------------------------------------------
    # Public entry-point
    # ------------------------------------------------------------------
    async def process_question(
        self,
        question: str,
        collection_name: str = "default",
        user_id: Optional[str] = None,
        language: str = "en",
        include_hints: bool = True,
        system_prompt: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Full agentic pipeline for a single user question.

        Returns a dict with:
            answer, concept, prerequisites, stepwise_reasoning, hint_ladder,
            confidence_score, related_concepts, sources, mode,
            nli_verdict, nli_confidence, nli_flags,
            intent_detected, difficulty_level
        """
        from app.services.ai_brain.reasoning_engine import reason_with_context

        # ── Step 1: Pinecone RAG ──────────────────────────────────────────
        rag_context, rag_sources = await self._retrieve_rag_context(
            question, collection_name
        )

        # ── Step 2: Internet research (only if no Pinecone results) ───────
        research_context: str = ""
        research_sources: list = []
        if not rag_context:
            research_context, research_sources = await self._try_internet_research(question)

        # ── Step 3: Combine context ───────────────────────────────────────
        all_sources = rag_sources + research_sources
        combined_rag = "\n\n".join(filter(None, [rag_context, research_context])) or None

        # ── Step 4: 7-layer AI Brain (NLI + trust scoring inside) ─────────
        result = await reason_with_context(
            question=question,
            user_id=user_id,
            language=language,
            include_hints=include_hints,
            system_prompt=system_prompt,
            rag_context=combined_rag,
        )

        # ── Step 5: Enrich and return ─────────────────────────────────────
        meta = result.metadata or {}
        mode = (
            "agentic_rag"     if rag_sources
            else "research"   if research_sources
            else "reasoning_engine"
        )

        return {
            "answer":            result.final_solution,
            "concept":           result.concept,
            "prerequisites":     result.prerequisites,
            "stepwise_reasoning": result.stepwise_reasoning,
            "hint_ladder":       result.hint_ladder,
            "confidence_score":  result.confidence_score,
            "related_concepts":  result.related_concepts,
            "sources":           all_sources,
            "mode":              mode,
            # Layer 7 — NLI verdict
            "nli_verdict":       meta.get("nli_verdict"),
            "nli_confidence":    meta.get("nli_confidence"),
            "nli_flags":         int(meta.get("nli_flags") or 0),
            # Cognitive trace fields
            "intent_detected":   meta.get("intent_detected", "Learning"),
            "difficulty_level":  int(meta.get("difficulty_level") or 5),
            "language":          result.language,
        }


# ── Singleton ─────────────────────────────────────────────────────────────────
logger.info("Creating Agentic RAG service...")
try:
    agentic_rag_service = AgenticRAGService()
    logger.info("✅ Agentic RAG service created")
except Exception as _e:
    logger.error("❌ Failed to create Agentic RAG service: %s", _e)
    agentic_rag_service = None


# ---------------------------------------------------------------------------
# Backwards-compatible stub (kept so any code that imported RAGState won't fail)
# ---------------------------------------------------------------------------

class RAGState:
    """Stub — LangGraph workflow removed after Bedrock migration."""
    pass



