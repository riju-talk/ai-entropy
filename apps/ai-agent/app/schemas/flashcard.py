"""
Flashcard-related Pydantic models
"""

from pydantic import BaseModel, Field
from typing import List
from enum import Enum

class DifficultyLevel(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"

class FlashcardRequest(BaseModel):
    user_id: str
    topic: str = Field(..., min_length=1, max_length=200)
    num_cards: int = Field(default=10, ge=1, le=50)
    difficulty: DifficultyLevel = DifficultyLevel.MEDIUM

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "user_123",
                "topic": "Python Data Structures",
                "num_cards": 10,
                "difficulty": "medium"
            }
        }

class Flashcard(BaseModel):
    front: str
    back: str

class FlashcardResponse(BaseModel):
    flashcards: List[Flashcard]
    credits_used: float
    total_generated: int
