"""
NOVYRA AI Brain - Layer 5: Context Assembly

Assembles rich context for LLM prompt from all previous layers.
Reference: docs/AI_BRAIN_ARCHITECTURE.md Layer 5
"""
import logging
from typing import Optional
from dataclasses import dataclass

from app.services.ai_brain.intent_detector import Intent, detect_intent, get_response_strategy
from app.services.ai_brain.concept_mapper import map_question_to_concepts, ConceptMatch
from app.services.ai_brain.graph_traversal import build_graph_context, GraphContext
from app.services.ai_brain.cognitive_state import compute_cognitive_state, CognitiveState

logger = logging.getLogger(__name__)


@dataclass
class AssembledContext:
    """Complete context for reasoning engine."""
    question: str
    intent: Intent
    response_strategy: dict
    primary_concept: Optional[ConceptMatch]
    graph_context: Optional[GraphContext]
    cognitive_state: Optional[CognitiveState]
    should_provide_hints: bool
    difficulty_adjustment: str  # "easier", "normal", "harder"


async def assemble_context(
    question: str,
    user_id: Optional[str] = None,
    language: str = "en"
) -> AssembledContext:
    """
    Assemble comprehensive context from all AI Brain layers.
    
    This is the central orchestration point that coordinates:
    - Layer 1: Intent detection
    - Layer 2: Concept mapping
    - Layer 3: Graph traversal
    - Layer 4: Cognitive state
    
    Args:
        question: User's question
        user_id: Optional user ID for personalization
        language: Question language
    
    Returns:
        AssembledContext ready for reasoning engine
    """
    logger.info(f"Assembling context for question: {question[:60]}...")
    
    # Layer 1: Detect intent
    intent = await detect_intent(question)
    response_strategy = await get_response_strategy(intent)
    
    # Layer 2: Map to concepts
    concepts = await map_question_to_concepts(question)
    primary_concept = concepts[0] if concepts else None
    
    # Layer 3: Build graph context (if concept found)
    graph_context = None
    if primary_concept and primary_concept.concept_id:
        graph_context = await build_graph_context(
            primary_concept.concept_id,
            user_id
        )
    
    # Layer 4: Get cognitive state (if user provided)
    cognitive_state = None
    if user_id:
        cognitive_state = await compute_cognitive_state(user_id)
    
    # Determine hint necessity
    should_provide_hints = True
    if cognitive_state and primary_concept:
        from app.services.ai_brain.cognitive_state import should_provide_hints as check_hints
        should_provide_hints = await check_hints(cognitive_state, primary_concept.concept_id or "")
    
    # Difficulty adjustment based on cognitive state
    difficulty_adjustment = "normal"
    if cognitive_state:
        if cognitive_state.overall_mastery < 0.3:
            difficulty_adjustment = "easier"
        elif cognitive_state.overall_mastery > 0.7:
            difficulty_adjustment = "harder"
    
    context = AssembledContext(
        question=question,
        intent=intent,
        response_strategy=response_strategy,
        primary_concept=primary_concept,
        graph_context=graph_context,
        cognitive_state=cognitive_state,
        should_provide_hints=should_provide_hints,
        difficulty_adjustment=difficulty_adjustment
    )
    
    logger.info(f"Context assembled: intent={intent.intent_type.value}, concept={primary_concept.concept_name if primary_concept else 'none'}")
    
    return context


def format_context_for_prompt(context: AssembledContext) -> str:
    """
    Format assembled context into a prompt section for the LLM.
    
    Args:
        context: Assembled context
    
    Returns:
        Formatted string for LLM prompt
    """
    sections = []
    
    # Intent and strategy
    sections.append(f"**Question Intent:** {context.intent.intent_type.value}")
    sections.append(f"**Response Style:** {context.response_strategy['style']}")
    
    # Concept information
    if context.primary_concept:
        sections.append(f"**Primary Concept:** {context.primary_concept.concept_name}")
        sections.append(f"**Concept Confidence:** {context.primary_concept.confidence:.2f}")
    
    # Graph context
    if context.graph_context:
        gc = context.graph_context
        sections.append(f"**Concept Difficulty:** {gc.difficulty}/10")
        
        if gc.prerequisites:
            prereq_names = [p["name"] for p in gc.prerequisites[:3]]
            sections.append(f"**Prerequisites:** {', '.join(prereq_names)}")
        
        if gc.related_concepts:
            related_names = [c["name"] for c in gc.related_concepts[:3]]
            sections.append(f"**Related Concepts:** {', '.join(related_names)}")
        
        if gc.dependent_concepts:
            dep_names = [c["name"] for c in gc.dependent_concepts[:2]]
            sections.append(f"**Next Steps:** {', '.join(dep_names)}")
    
    # Cognitive state
    if context.cognitive_state:
        cs = context.cognitive_state
        sections.append(f"**User Mastery Level:** {cs.overall_mastery:.2f}")
        sections.append(f"**Difficulty Adjustment:** {context.difficulty_adjustment}")
        
        if cs.struggling_concepts:
            struggling_names = [c.concept_name for c in cs.struggling_concepts[:2]]
            sections.append(f"**User Struggles With:** {', '.join(struggling_names)}")
    
    # Hint guidance
    if context.should_provide_hints:
        sections.append("**Provide Hints:** Yes - include incremental hint ladder")
    else:
        sections.append("**Provide Hints:** Minimal - user has high mastery")
    
    return "\n".join(sections)


def get_contextual_instructions(context: AssembledContext) -> str:
    """
    Generate specific instructions for the LLM based on context.
    
    Args:
        context: Assembled context
    
    Returns:
        Instruction string for LLM
    """
    instructions = []
    
    # Intent-specific instructions
    if context.intent.intent_type.value == "problem_solving":
        instructions.append("Guide the user through problem-solving steps systematically.")
    elif context.intent.intent_type.value == "concept_explanation":
        instructions.append("Provide a clear definition with examples and common misconceptions.")
    elif context.intent.intent_type.value == "comparison":
        instructions.append("Structure your answer as a systematic comparison with pros/cons.")
    
    # Difficulty adjustment
    if context.difficulty_adjustment == "easier":
        instructions.append("Use simpler language and more basic examples. Break down complex ideas.")
    elif context.difficulty_adjustment == "harder":
        instructions.append("Provide advanced insights and edge cases. Challenge the user's understanding.")
    
    # Hint guidance
    if context.should_provide_hints:
        instructions.append("Include a hint ladder: start with conceptual hints, progress to concrete steps.")
    else:
        instructions.append("Provide minimal hints - focus on direct solution and insights.")
    
    # Graph-based guidance
    if context.graph_context:
        if context.graph_context.prerequisites:
            unmastered = [p for p in context.graph_context.prerequisites if not p.get("mastered")]
            if unmastered:
                prereq_names = [p["name"] for p in unmastered[:2]]
                instructions.append(
                    f"Note: User may need review of prerequisites: {', '.join(prereq_names)}"
                )
    
    return " ".join(instructions)


logger.info("Context assembly module initialized")
