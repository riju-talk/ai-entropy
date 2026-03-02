"""
Chat-related Pydantic models
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime

class ChatRequest(BaseModel):
    user_id: str = Field(..., description="User ID")
    message: str = Field(..., min_length=1, max_length=2000)
    session_id: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "user_123",
                "message": "How do neural networks work?",
                "session_id": "session_abc"
            }
        }

class ChatResponse(BaseModel):
    session_id: str
    response: str
    follow_up_questions: List[str]
    credits_used: float
    timestamp: datetime = Field(default_factory=datetime.now)

class ConversationHistory(BaseModel):
    session_id: str
    messages: List[Dict[str, str]]
