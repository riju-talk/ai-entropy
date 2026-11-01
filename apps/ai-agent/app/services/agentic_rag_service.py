"""
Agentic RAG entry point.

The pipeline itself lives in app.services.harness (8 stages run as a dependency graph with streaming).
This module keeps the long-standing `agentic_rag_service.process_question(...)` call that the Q&A route
and tests use, returning the same result dict.
"""
import logging
from typing import Any, Dict, List, Optional

from app.services import harness

logger = logging.getLogger(__name__)


class AgenticRAGService:
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
        return await harness.run_to_completion(
            question=question,
            user_id=user_id,
            language=language,
            collection=collection_name,
            history=conversation_history,
            system_prompt=system_prompt,
            include_hints=include_hints,
        )


agentic_rag_service = AgenticRAGService()
