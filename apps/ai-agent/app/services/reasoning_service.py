"""
NOVYRA — Structured Reasoning Engine

Enhanced with 8-layer AI Brain architecture.

Flow:
  1. Detect language of question
  2. If non-English → translate to English
  3. Assemble context (Layers 1-5: intent, concepts, graph, cognitive state)
  4. Call enhanced reasoning engine (Layer 6)
  5. NLI validation (Layer 7) ✅
  6. Trust scoring (Layer 8) ✅
  7. If non-English → translate final_solution back
  8. Return ReasoningResponse
"""
from __future__ import annotations
import json
import logging
from typing import Optional

from google.genai.errors import ClientError

from app.core.llm import generate_json
from app.core.prompts import REASONING_SYSTEM, REASONING_PROMPT
from app.schemas.reasoning import ReasoningResponse
from app.services import multilingual_service as ml
from app.services import knowledge_graph_service as kg

logger = logging.getLogger(__name__)

# Feature flag: use enhanced reasoning with full AI Brain layers
USE_ENHANCED_REASONING = True


async def reason(
    question: str,
    user_id: Optional[str] = None,
    language: str = "en",
    include_hints: bool = True,
) -> ReasoningResponse:
    """
    Core reasoning entry-point.
    
    Routes to enhanced reasoning engine (with AI Brain layers) or legacy engine.
    
    Returns a validated ReasoningResponse.
    """
    # Use enhanced reasoning if available
    if USE_ENHANCED_REASONING:
        try:
            from app.services.ai_brain.reasoning_engine import reason_with_context
            logger.info("Using enhanced reasoning engine with AI Brain layers")
            return await reason_with_context(
                question=question,
                user_id=user_id,
                language=language,
                include_hints=include_hints
            )
        except ImportError as e:
            logger.warning(f"Enhanced reasoning not available: {e}. Falling back to legacy.")
        except ClientError:
            raise  # quota / auth errors — don't waste another call on legacy
        except Exception as e:
            logger.error(f"Enhanced reasoning failed: {e}. Falling back to legacy.")
    
    # Legacy reasoning (fallback)
    logger.info("Using legacy reasoning engine")
    
    # --- 1. Translate to English if needed ---
    working_question = question
    if language != "en":
        working_question = await ml.to_english(question, source_lang=language)
        logger.info("Translated question: %s → %s", question[:60], working_question[:60])

    # --- 2. Fetch graph context ---
    graph_context = "No graph context available."
    if user_id:
        try:
            # Try to extract concept name from question (simple heuristic: first noun phrase)
            # A richer approach would use a dedicated concept-extraction call
            concept_guess = working_question.split("?")[0][:80]
            ctx = await kg.fetch_concept_context(concept_guess)
            if ctx["prerequisites"] or ctx["related"]:
                graph_context = (
                    f"Prerequisites: {', '.join(ctx['prerequisites']) or 'none'}. "
                    f"Related concepts: {', '.join(ctx['related']) or 'none'}."
                )
        except Exception as exc:
            logger.warning("Graph context fetch failed: %s", exc)

    # --- 3. Build prompt ---
    prompt = REASONING_PROMPT.format(
        question=working_question,
        graph_context=graph_context,
    )

    # --- 4. Call LLM ---
    raw: dict = await generate_json(prompt, system_prompt=REASONING_SYSTEM)

    # --- 5. Validate ---
    # Strip hint_ladder if caller doesn't want it
    if not include_hints:
        raw["hint_ladder"] = []

    response = ReasoningResponse(**raw)

    # --- 6. Translate answer back ---
    if language != "en":
        response.final_solution = await ml.from_english(
            response.final_solution, target_lang=language
        )
        response.language = language

    return response
