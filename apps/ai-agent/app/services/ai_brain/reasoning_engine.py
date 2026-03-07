"""
Entropy AI AI Brain - Layer 6: Enhanced Reasoning Engine

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


ENHANCED_REASONING_SYSTEM = """You are a warm, encouraging AI tutor. Your job is to help students truly understand concepts — not just give answers.

Your tone is:
- Patient, supportive, and nurturing — like a great teacher who believes in the student.
- Clear and structured — never overwhelming.
- Honest: if something is complex, say so and break it down step by step.

You have access to:
- The student's question and learning context
- Concept relationships from a knowledge graph
- The student's current mastery level and progress
- Prerequisites and related concepts
- Retrieved document context (may contain unrelated topics — do not let these distract you)

Your goal is to provide educational, accurate, and personalized explanations that:
1. Directly answer what the student asked
2. Guide them through reasoning steps (not just answers)
3. Connect concepts to their prerequisites and real-world applications
4. Adapt difficulty based on their mastery

STRICT RULES:
- Do NOT use any emojis anywhere in any field of your JSON response.
- Do NOT use any emojis — not even punctuation substitutes like :) or :D.
- primary_concept MUST describe what the STUDENT'S QUESTION is about, not what
  appears in the retrieved document context. If the question is about political
  freedom, primary_concept = "Political Freedom" — NOT "Game Theory" or any other
  topic that appeared in a retrieved document but was not what was asked.
- The fields "primary_concept", "prerequisites", "related_concepts", and all
  concept-related string values MUST be written in English, regardless of the
  question language. These values are stored in a database; they must be English.
- If the question is in Hindi or another language, answer in that language ONLY in
  "final_solution". All other fields (primary_concept, prerequisites, etc.) stay in English.

FORMATTING FOR "final_solution" — THIS IS MANDATORY, NOT OPTIONAL:
You MUST write final_solution using Markdown structure. Plain prose without headings
is not acceptable. Follow this layout exactly:
  - Start with a one-line **bold** summary sentence (no heading above it).
  - Use ## for major sections (e.g., ## Explanation, ## Key Points, ## Example).
  - Use ### for subsections when needed.
  - Use --- horizontal rules to separate major sections.
  - Use **bold** for key terms when first introduced.
  - Use `inline code` for short expressions, variable names, or syntax.
  - Use fenced code blocks (```language\n...\n```) for multi-line code.
  - Use numbered lists for sequential steps; bullet lists for unordered items.
  - End every response with a ## Summary section containing 2-3 bullet points.
  - NEVER write a wall of unbroken prose — every concept needs its own section.

Always return valid JSON matching the schema."""


ENHANCED_REASONING_PROMPT = """
{contextual_context}
{locked_concept_section}
{rag_section}
---

**Question:** {question}

**Instructions:** {contextual_instructions}

{citation_instruction}
---

Provide a comprehensive reasoning response in JSON format.

IMPORTANT RULES FOR THIS RESPONSE:
1. "primary_concept" MUST be the topic the question is asking about — derive it from
   the QUESTION TEXT, not from the retrieved document context.
2. "prerequisites" and "related_concepts" MUST be English strings.
3. "final_solution" MUST be richly formatted Markdown with ## headings, **bold** terms,
   bullet/numbered lists, --- dividers, and a ## Summary at the end.
   Do NOT return final_solution as plain prose — that is a failure.
4. If internet sources are provided above, cite them inline as [1], [2] etc. and
   add a ## Sources section at the very end of final_solution listing cited URLs.

{{
  "intent_detected": "the question type",
  "primary_concept": "main concept in English",
  "reasoning_steps": [
    "Step 1: ...",
    "Step 2: ...",
    "Step N: reach solution"
  ],
  "final_solution": "**Bold summary sentence.**\\n\\n---\\n\\n## Key Concept\\n\\n**Term** explanation here.\\n\\n---\\n\\n## Steps\\n\\n1. First step\\n2. Second step\\n\\n---\\n\\n## Example\\n\\n```python\\n# code here\\n```\\n\\n---\\n\\n## Summary\\n\\n- Point 1\\n- Point 2\\n\\n---\\n\\n## Sources\\n\\n1. https://example.com",
  "confidence": 0.0,
  "hint_ladder": [
    "Hint 1: conceptual nudge",
    "Hint 2: more specific direction"
  ],
  "prerequisites": ["EnglishConcept1", "EnglishConcept2"],
  "related_concepts": ["EnglishConcept3", "EnglishConcept4"],
  "next_steps": "what to study after this",
  "difficulty_level": 5,
  "misconceptions": ["Common mistake 1", "Common mistake 2"]
}}
"""


async def reason_with_context(
    question: str,
    user_id: Optional[str] = None,
    language: str = "en",
    include_hints: bool = True,
    system_prompt: Optional[str] = None,
    rag_context: Optional[str] = None,
) -> ReasoningResponse:
    """
    Enhanced reasoning engine that uses full AI Brain context.
    
    This is the complete Layer 6 implementation that orchestrates:
    - Layers 1-5 for context assembly
    - LLM inference with rich context
    - Layer 7 (NLI validation) âœ…
    - Layer 8 (trust scoring) âœ…
    
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
        logger.info(f"Translated question: {question[:40]} â†’ {working_question[:40]}")
    
    # Assemble context from Layers 1-5
    context = await assemble_context(working_question, user_id, language)
    
    # Format context for prompt
    contextual_context = format_context_for_prompt(context)
    contextual_instructions = get_contextual_instructions(context)
    
    # Build RAG section (Pinecone retrieved chunks + Tavily web sources)
    rag_section = ""
    if rag_context:
        rag_section = rag_context
        logger.info("RAG/web context injected (%d chars)", len(rag_context))

    # Locked concept section — prevents the LLM from substituting a concept
    # from the retrieved documents instead of what the student actually asked.
    locked_concept_section = ""
    if context.primary_concept and context.primary_concept.concept_name:
        locked = context.primary_concept.concept_name
        locked_concept_section = (
            f'**LOCKED PRIMARY CONCEPT** (determined from your question — do NOT change):\n'
            f'"{locked}"\n'
            f'You MUST use this exact value as "primary_concept" in your JSON. '
            f'Do not substitute a concept from the retrieved documents.'
        )

    # Citation instruction — only shown when web/doc sources are present
    citation_instruction = ""
    if rag_context:
        citation_instruction = (
            "**Citation rule:** Whenever you state a fact sourced from the materials above, "
            "add an inline citation like [1] or [Doc 1]. "
            "End final_solution with a ## Sources section listing every URL you cited."
        )

    # Build enhanced prompt
    prompt = ENHANCED_REASONING_PROMPT.format(
        contextual_context=contextual_context,
        locked_concept_section=locked_concept_section,
        rag_section=rag_section,
        question=working_question,
        contextual_instructions=contextual_instructions,
        citation_instruction=citation_instruction,
    )
    
    # Call LLM
    logger.info("Calling LLM with enhanced context...")
    # Append session-level instructions to the base system prompt rather
    # than replacing it, so JSON-schema requirements are always preserved.
    effective_system = ENHANCED_REASONING_SYSTEM
    if system_prompt:
        effective_system = ENHANCED_REASONING_SYSTEM + "\n\nAdditional session instructions: " + system_prompt
    raw = await generate_json(prompt, system_prompt=effective_system)

    # Extract cognitive trace fields before they get discarded by schema mapping
    _intent_detected: str = str(raw.get("intent_detected") or "Learning")
    _difficulty_level: int = int(raw.get("difficulty_level") or 5)

    # Map enhanced AI Brain output fields â†’ ReasoningResponse schema fields
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
