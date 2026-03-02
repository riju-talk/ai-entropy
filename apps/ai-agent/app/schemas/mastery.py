"""
NOVYRA — Pydantic schemas for the Mastery Tracking Engine
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
