"""
NOVYRA — Pydantic schemas for the Rubric Evaluation Engine
"""
from __future__ import annotations
from typing import List, Optional, Literal
from pydantic import BaseModel, Field


class RubricCriterion(BaseModel):
    name: str
    weight: float = Field(..., gt=0.0, le=1.0, description="Weight (0-1); all weights should sum to 1")
    description: Optional[str] = None


class RubricSchema(BaseModel):
    criteria: List[RubricCriterion]


class EvaluationRequest(BaseModel):
    submission: str = Field(..., min_length=10, description="Student's answer or essay")
    rubric: RubricSchema
    user_id: Optional[str] = None
    concept: Optional[str] = None   # tie to knowledge graph


class CriterionScore(BaseModel):
    name: str
    weight: float
    score: float = Field(..., ge=0.0, le=1.0)
    feedback: str


class EvaluationResponse(BaseModel):
    criterion_scores: List[CriterionScore]
    weighted_total: float = Field(..., ge=0.0, le=100.0)
    overall_feedback: str
    improvement_plan: List[str] = []
    grade_level: Literal["Excellent", "Good", "Satisfactory", "Needs Improvement"]
