"""
NOVYRA AI Brain - Layer 1: Intent Detection

Classifies user questions into intent categories for appropriate handling.
Reference: docs/AI_BRAIN_ARCHITECTURE.md Layer 1
"""
import logging
from typing import Optional
from enum import Enum

from app.core.llm import generate_json

logger = logging.getLogger(__name__)


class IntentType(str, Enum):
    """Question intent categories."""
    CONCEPT_EXPLANATION = "concept_explanation"  # "What is X?"
    PROBLEM_SOLVING = "problem_solving"  # "How do I solve this?"
    COMPARISON = "comparison"  # "What's the difference between X and Y?"
    PROCEDURE = "procedure"  # "What are the steps to do X?"
    CLARIFICATION = "clarification"  # "Why does X work this way?"
    EXAMPLE_REQUEST = "example_request"  # "Can you give an example of X?"
    FACTUAL = "factual"  # "When was X discovered?"
    OPEN_ENDED = "open_ended"  # "What are some applications of X?"


class Intent:
    """Detected intent with confidence."""
    def __init__(self, intent_type: IntentType, confidence: float, reasoning: str):
        self.intent_type = intent_type
        self.confidence = confidence
        self.reasoning = reasoning
    
    def to_dict(self):
        return {
            "intent_type": self.intent_type.value,
            "confidence": self.confidence,
            "reasoning": self.reasoning
        }


INTENT_DETECTION_PROMPT = """Analyze the following question and classify its primary intent.

Question: {question}

Classify into ONE of these categories:
- concept_explanation: User wants to understand what something is
- problem_solving: User needs help solving a specific problem
- comparison: User wants to compare multiple concepts
- procedure: User wants step-by-step instructions
- clarification: User wants to understand why/how something works
- example_request: User wants concrete examples
- factual: User wants factual information (dates, names, etc.)
- open_ended: User wants broad exploration of a topic

Return JSON:
{{
  "intent_type": "one of the categories above",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation of why this intent was chosen"
}}
"""


async def detect_intent(question: str) -> Intent:
    """
    Detect the primary intent of a user question.
    
    Uses LLM to classify question type for appropriate response strategy.
    
    Args:
        question: User's question text
    
    Returns:
        Intent with type, confidence, and reasoning
    """
    try:
        prompt = INTENT_DETECTION_PROMPT.format(question=question)
        
        result = await generate_json(
            prompt,
            system_prompt="You are an expert at understanding user intent in educational contexts."
        )
        
        intent_type = IntentType(result["intent_type"])
        confidence = float(result["confidence"])
        reasoning = result["reasoning"]
        
        logger.info(f"Detected intent: {intent_type.value} (confidence: {confidence:.2f})")
        
        return Intent(intent_type, confidence, reasoning)
    
    except Exception as e:
        logger.error(f"Intent detection failed: {e}")
        # Default fallback: treat as concept explanation
        return Intent(
            IntentType.CONCEPT_EXPLANATION,
            0.5,
            "Fallback intent due to detection error"
        )


async def get_response_strategy(intent: Intent) -> dict:
    """
    Get recommended response strategy based on detected intent.
    
    Returns:
        Dict with strategy hints for the reasoning engine
    """
    strategies = {
        IntentType.CONCEPT_EXPLANATION: {
            "style": "clear_definition",
            "structure": ["definition", "key_properties", "examples", "misconceptions"],
            "hint_level": "gradual",
        },
        IntentType.PROBLEM_SOLVING: {
            "style": "step_by_step",
            "structure": ["understand_problem", "identify_approach", "solve", "verify"],
            "hint_level": "incremental",
        },
        IntentType.COMPARISON: {
            "style": "structured_comparison",
            "structure": ["similarities", "differences", "use_cases", "summary"],
            "hint_level": "moderate",
        },
        IntentType.PROCEDURE: {
            "style": "procedural",
            "structure": ["prerequisites", "steps", "common_pitfalls", "verification"],
            "hint_level": "detailed",
        },
        IntentType.CLARIFICATION: {
            "style": "explanatory",
            "structure": ["context", "mechanism", "reasoning", "implications"],
            "hint_level": "conceptual",
        },
        IntentType.EXAMPLE_REQUEST: {
            "style": "example_driven",
            "structure": ["basic_example", "complex_example", "edge_cases"],
            "hint_level": "concrete",
        },
        IntentType.FACTUAL: {
            "style": "concise_factual",
            "structure": ["direct_answer", "context", "sources"],
            "hint_level": "minimal",
        },
        IntentType.OPEN_ENDED: {
            "style": "exploratory",
            "structure": ["overview", "key_areas", "applications", "further_reading"],
            "hint_level": "guide",
        }
    }
    
    return strategies.get(intent.intent_type, strategies[IntentType.CONCEPT_EXPLANATION])


logger.info("Intent detector initialized")
