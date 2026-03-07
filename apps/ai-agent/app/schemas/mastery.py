"""
Entropy AI â€” Pydantic schemas for the Mastery Tracking Engine
"""
from __future__ import annotations
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field


class AttemptRecord(BaseModel):
    """Single student attempt on a concept."""
    user_id: str
    concept: str
    is_correct: bool
    time_taken_seconds: Optional[int] = None
    hints_used: int = 0
    timestamp: Optional[datetime] = None


class MasteryRecord(BaseModel):
    user_id: str
    concept: str
    total_attempts: int = 0
    correct_attempts: int = 0
    mastery_score: float = Field(0.0, ge=0.0, le=1.0)
    confidence_weight: float = Field(1.0, ge=0.0, le=1.0)
    last_seen: Optional[datetime] = None


class MasteryUpdateRequest(BaseModel):
    user_id: str
    concept: str
    is_correct: bool
    time_taken_seconds: Optional[int] = None
    hints_used: int = 0
    # Evidence weight — how strongly this interaction should affect mastery.
    # exam=1.0, quiz=0.8, practice=0.6, chat=0.2, explanation=0.1
    evidence_weight: float = Field(1.0, ge=0.0, le=1.0)


class MasteryUpdateResponse(BaseModel):
    user_id: str
    concept: str
    mastery_score: float
    delta: float            # change from previous score
    status: str             # "improving" | "mastered" | "struggling"
    nudge: Optional[str] = None  # personalised study suggestion


class MasteryProfileResponse(BaseModel):
    user_id: str
    concepts: List[MasteryRecord]
    weak_concepts: List[str]
    strong_concepts: List[str]
    overall_progress: float  # 0-1 average across all concepts


class UserMetrics(BaseModel):
    """Algorithmically computed learning metrics (never LLM-guessed)."""
    avg_mastery: float = 0.0           # mean mastery across all concepts
    volatility: float = 0.0           # std-dev of last 10 attempt scores
    consistency: float = 1.0          # 1 - normalised volatility
    domain_coverage: float = 0.0      # fraction of concepts mastered (≥0.75)
    exam_readiness: float = 0.0       # composite score
    cognitive_load: float = 0.0       # difficulty - mastery (clamped 0-1)
