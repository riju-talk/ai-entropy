"""
NOVYRA — Pydantic schemas for the Structured Reasoning Engine
"""
from __future__ import annotations
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


# ---------------------------------------------------------------------------
# Request
# ---------------------------------------------------------------------------
class ReasoningRequest(BaseModel):
    question: str = Field(..., min_length=3, description="Student question")
    user_id: Optional[str] = Field(None, description="User ID to pull graph context")
    language: str = Field("en", description="Input language code (e.g. 'en', 'hi')")
    include_hints: bool = Field(True, description="Whether to generate hint ladder")


# ---------------------------------------------------------------------------
# Response
# ---------------------------------------------------------------------------
class ReasoningResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")  # ignore unknown fields from enhanced LLM output

    concept: str
    prerequisites: List[str] = []
    stepwise_reasoning: List[str] = []
    hint_ladder: List[str] = []
    final_solution: str
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    related_concepts: List[str] = []
    language: str = "en"   # language the answer is returned in
    metadata: Optional[Dict[str, Any]] = None  # NLI validation results, trust scores, etc.


class ReasoningResponseTranslated(ReasoningResponse):
    """Response with translated final_solution for non-English input."""
    original_language: str
    translated_final_solution: str
