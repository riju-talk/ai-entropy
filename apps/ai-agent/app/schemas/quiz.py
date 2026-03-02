"""
Quiz-related Pydantic models
"""

from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum

class QuestionType(str, Enum):
    MCQ = "mcq"
    TRUE_FALSE = "true_false"
    SHORT_ANSWER = "short_answer"

class QuizRequest(BaseModel):
    user_id: str
    topic: str = Field(..., min_length=1, max_length=200)
    num_questions: int = Field(default=5, ge=1, le=20)
    question_types: List[QuestionType] = [
        QuestionType.MCQ,
        QuestionType.TRUE_FALSE
    ]

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "user_123",
                "topic": "Database Normalization",
                "num_questions": 5,
                "question_types": ["mcq", "true_false"]
            }
        }

class QuizQuestion(BaseModel):
    type: QuestionType
    question: str
    options: Optional[List[str]] = None
    correct_answer: str
    explanation: str

class QuizResponse(BaseModel):
    quiz: List[QuizQuestion]
    credits_used: float
    total_questions: int
