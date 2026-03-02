"""
NOVYRA AI Brain - Layer 6: Enhanced Reasoning Engine

Advanced reasoning that leverages full context from Layers 1-5.
Reference: docs/AI_BRAIN_ARCHITECTURE.md Layer 6
"""
import logging
from typing import Optional

from app.core.llm import generate_json
from app.schemas.reasoning import ReasoningResponse
from app.services.ai_brain.context_assembler import (
    assemble_context,
    format_context_for_prompt,
    get_contextual_instructions
)
from app.services import multilingual_service as ml

logger = logging.getLogger(__name__)


ENHANCED_REASONING_SYSTEM = """You are an expert AI tutor for computer science and mathematics.

You have access to:
- The user's question intent and learning style preferences
- Concept relationships from a knowledge graph
- The user's current mastery level and learning progress
- Prerequisites and related concepts

Your goal is to provide educational, accurate, and personalized explanations that:
1. Match the user's current understanding level
2. Guide them through reasoning steps (not just answers)
3. Connect concepts to their prerequisites and applications
4. Adapt difficulty based on their mastery

Always return valid JSON matching the schema."""


ENHANCED_REASONING_PROMPT = """
{contextual_context}

---

**Question:** {question}

**Instructions:** {contextual_instructions}

---

Provide a comprehensive reasoning response in JSON format:

{{
  "intent_detected": "the question type",
  "primary_concept": "main concept addressed",
  "reasoning_steps": [
    "step 1: analyze the problem",
    "step 2: identify approach",
    "step 3: ...",
    "step N: reach solution"
  ],
  "final_solution": "the complete answer with clear explanations",
  "confidence": 0.0-1.0,
  "hint_ladder": [
    "hint 1: conceptual guidance",
    "hint 2: more specific direction",
    "hint 3: ...",
    "hint N: near-complete solution"
  ],
  "prerequisites": ["concept1", "concept2"],
  "related_concepts": ["concept3", "concept4"],
  "next_steps": "what to learn after mastering this",
  "difficulty_level": 1-10,
  "misconceptions": ["common mistake 1", "common mistake 2"]
}}
"""


async def reason_with_context(
    question: str,
    user_id: Optional[str] = None,
    language: str = "en",
    include_hints: bool = True
) -> ReasoningResponse:
    """
    Enhanced reasoning engine that uses full AI Brain context.
    
    This is the complete Layer 6 implementation that orchestrates:
    - Layers 1-5 for context assembly
    - LLM inference with rich context
    - Layer 7 (NLI validation) ✅
    - Layer 8 (trust scoring) ✅
    
    Args:
        question: User's question
        user_id: Optional user ID for personalization
        language: Question language
        include_hints: Whether to include hint ladder
    
    Returns:
        ReasoningResponse with full reasoning breakdown
    """
    logger.info(f"Enhanced reasoning for: {question[:60]}...")
    
    # Translate to English if needed
    working_question = question
    if language != "en":
        working_question = await ml.to_english(question, source_lang=language)
        logger.info(f"Translated question: {question[:40]} → {working_question[:40]}")
    
    # Assemble context from Layers 1-5
    context = await assemble_context(working_question, user_id, language)
    
    # Format context for prompt
    contextual_context = format_context_for_prompt(context)
    contextual_instructions = get_contextual_instructions(context)
    
    # Build enhanced prompt
    prompt = ENHANCED_REASONING_PROMPT.format(
        contextual_context=contextual_context,
        question=working_question,
        contextual_instructions=contextual_instructions
    )
    
    # Call LLM
    logger.info("Calling LLM with enhanced context...")
    raw = await generate_json(prompt, system_prompt=ENHANCED_REASONING_SYSTEM)

    # Extract cognitive trace fields before they get discarded by schema mapping
    _intent_detected: str = str(raw.get("intent_detected") or "Learning")
    _difficulty_level: int = int(raw.get("difficulty_level") or 5)

    # Map enhanced AI Brain output fields → ReasoningResponse schema fields
    # The enhanced prompt returns: primary_concept, reasoning_steps, confidence, intent_detected, etc.
    # But ReasoningResponse expects: concept, stepwise_reasoning, confidence_score
    mapped = {
        "concept": raw.get("primary_concept") or raw.get("concept") or "Unknown",
        "prerequisites": raw.get("prerequisites", []),
        "stepwise_reasoning": raw.get("reasoning_steps") or raw.get("stepwise_reasoning", []),
        "hint_ladder": raw.get("hint_ladder", []),
        "final_solution": raw.get("final_solution", ""),
        "confidence_score": float(raw.get("confidence") or raw.get("confidence_score") or 0.8),
        "related_concepts": raw.get("related_concepts", []),
        "language": language,
    }
    
    # Strip hints if not requested
    if not include_hints or not context.should_provide_hints:
        mapped["hint_ladder"] = []
    
    # Validate and create response
    response = ReasoningResponse(**mapped)
    
    # Set language
    response.language = language
    
    # Translate answer back if needed
    if language != "en":
        response.final_solution = await ml.from_english(
            response.final_solution,
            target_lang=language
        )
    
    # Layer 7 - NLI Validation
    # Fact-check the final_solution against knowledge base
    try:
        from app.services.ai_brain.nli_validator import validate_response, emit_nli_event
        
        # Build NLI context from assembled context (use primary_concept, not context.concepts)
        concept_names = []
        if context.primary_concept:
            concept_names.append(context.primary_concept.concept_name)
        if context.graph_context and context.graph_context.related_concepts:
            concept_names.extend([c.get("name", "") for c in context.graph_context.related_concepts[:3]])
        nli_context = f"Concepts: {', '.join(concept_names)}" if concept_names else "General CS/Math context"
        nli_report = await validate_response(response.final_solution, nli_context)
        
        # Store NLI results in response metadata
        response.metadata = {
            "nli_verdict": nli_report.overall_verdict.value,
            "nli_confidence": nli_report.overall_confidence,
            "nli_flags": nli_report.flags_count,
            "intent_detected": _intent_detected,
            "difficulty_level": _difficulty_level,
        }
        
        # Emit NLI event for trust score updates
        if user_id:
            await emit_nli_event(user_id, nli_report)
        
        # Adjust response confidence based on NLI
        if nli_report.overall_verdict.value == "FLAG":
            response.confidence_score = max(0.0, response.confidence_score * 0.5)  # Penalize flagged responses
            logger.warning(f"NLI flagged response with {nli_report.flags_count} flags")
        
    except Exception as e:
        logger.error(f"NLI validation failed: {e}")
        response.metadata = {
            "nli_error": str(e),
            "intent_detected": _intent_detected,
            "difficulty_level": _difficulty_level,
        }
    
    logger.info(f"Enhanced reasoning complete: confidence={response.confidence_score:.2f}")
    
    return response


async def reason_simple(
    question: str,
    include_hints: bool = True
) -> ReasoningResponse:
    """
    Simple reasoning without user context.
    
    Falls back to basic reasoning when no user_id is provided.
    
    Args:
        question: User's question
        include_hints: Whether to include hints
    
    Returns:
        ReasoningResponse
    """
    return await reason_with_context(
        question=question,
        user_id=None,
        language="en",
        include_hints=include_hints
    )


logger.info("Enhanced reasoning engine initialized")
