"""
Entropy AI — Agentic RAG Orchestrator

Master pipeline:
  1. Tavily internet search (always active — provides live citations)
  2. Pinecone RAG retrieval (uploaded documents / knowledge base)
  3. 7-layer AI Brain (Layers 1–6) with injected context + numbered citations
  4. NLI validation (Layer 7)  — executed inside reasoning_engine
  5. Trust scoring  (Layer 8)  — executed inside reasoning_engine

Sources are numbered [1][2]… in the prompt so the LLM can inline-cite them
in final_solution (like NotebookLM / GPT).
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
        """Return (rag_context_str, sources_list) from Pinecone.
        Sources are normalised to {index, title, url, snippet, type}."""
        try:
            vector_store = self.langchain.load_vector_store(collection_name)
            if not vector_store:
                logger.info("No vector store found for collection: %s", collection_name)
                return "", []

            docs = vector_store.similarity_search(question, k=k)
            if not docs:
                return "", []

            sources = []
            context_parts = []
            for i, doc in enumerate(docs, start=1):
                meta = doc.metadata or {}
                title = meta.get("source") or meta.get("filename") or meta.get("title") or f"Doc {i}"
                snippet = doc.page_content[:400].strip()
                sources.append({
                    "index": i,
                    "title": title,
                    "url": meta.get("url") or meta.get("source") or "",
                    "snippet": snippet,
                    "type": "document",
                })
                context_parts.append(f"[Doc {i}] **{title}**\n{snippet}")

            rag_context = "\n\n---\n\n".join(context_parts)
            logger.info("Retrieved %d RAG chunks from Pinecone", len(docs))
            return rag_context, sources
        except Exception as exc:
            logger.warning("RAG retrieval failed: %s", exc)
            return "", []

    # ------------------------------------------------------------------
    # Step 2 — Tavily internet search (always active)
    # ------------------------------------------------------------------
    async def _search_internet(self, question: str, index_offset: int = 0) -> tuple:
        """
        Run a Tavily web search and return (formatted_context_str, sources_list).
        Sources are numbered starting from index_offset+1 to avoid clashing
        with Pinecone document indices.
        """
        try:
            from app.services.tavily_service import get_tavily_service
            svc = get_tavily_service()
            if not svc.available:
                return "", []

            results = await svc.search(question, max_results=5)
            if not results:
                return "", []

            # Re-index starting after any document sources
            for r in results:
                r["index"] = r["index"] + index_offset

            context = svc.format_for_prompt(results)
            logger.info("Tavily: %d web sources retrieved", len(results))
            return context, results
        except Exception as exc:
            logger.warning("Internet search failed: %s", exc)
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

        # ── Step 1: Pinecone RAG (uploaded documents) ──────────────────────
        rag_context, doc_sources = await self._retrieve_rag_context(
            question, collection_name
        )

        # ── Step 2: Tavily internet search (always active) ─────────────────
        # Web sources are numbered after any document sources
        web_context, web_sources = await self._search_internet(
            question, index_offset=len(doc_sources)
        )

        # ── Step 3: Combine all sources ────────────────────────────────────
        all_sources = doc_sources + web_sources

        # Build combined context string — document first, then numbered web sources
        context_sections = []
        if rag_context:
            context_sections.append(
                "**Document Context (from your uploaded files):**\n\n" + rag_context
            )
        if web_context:
            context_sections.append(web_context)
        combined_rag: str | None = "\n\n---\n\n".join(context_sections) or None

        # ── Step 3.5: Collective learning intelligence ───────────────────
        # Enrich context with platform-wide stats for concepts mentioned in question.
        # This gives every answer the benefit of what thousands of learners have struggled with.
        try:
            from app.services import knowledge_graph_service as _kg
            global_stats = await _kg.get_concepts_matching_question(question)
            if global_stats:
                lines = ["**Collective Learning Intelligence (platform-wide data):**"]
                for cname, s in list(global_stats.items())[:4]:
                    if s["total_learners"] >= 2:
                        struggle = s["struggle_rate"]
                        avg_m = s["avg_mastery"]
                        note = (
                            f"{struggle}% of learners find this challenging"
                            if struggle > 40
                            else f"avg mastery {avg_m}% across {s['total_learners']} learners"
                        )
                        lines.append(f"  - '{cname}': {note}.")
                if len(lines) > 1:
                    global_intelligence = "\n".join(lines)
                    combined_rag = (
                        global_intelligence + "\n\n" + (combined_rag or "")
                    ).strip() or None
        except Exception as _ge:
            logger.debug("Global intelligence enrichment skipped: %s", _ge)

        # ── Step 3.6: Conversation history context ────────────────────────
        # Prepend the last few turns so the reasoning engine maintains coherence.
        if conversation_history:
            recent_turns = conversation_history[-6:]  # last 3 exchanges
            history_lines = ["**Prior conversation context:**"]
            for msg in recent_turns:
                role_label = "Student" if msg.get("role") == "user" else "Tutor"
                content_preview = str(msg.get("content", ""))[:300]
                history_lines.append(f"  [{role_label}]: {content_preview}")
            history_str = "\n".join(history_lines)
            combined_rag = (history_str + "\n\n" + (combined_rag or "")).strip() or None

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
            "agentic_rag"   if doc_sources
            else "web_rag"  if web_sources
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
            "sources":           all_sources,   # [{index, title, url, snippet, type}]
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



