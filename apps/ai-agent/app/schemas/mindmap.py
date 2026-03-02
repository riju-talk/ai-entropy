"""
Mind map-related Pydantic models
"""

from pydantic import BaseModel, Field
from typing import Dict, Any
from enum import Enum

class MindMapStyle(str, Enum):
    HIERARCHICAL = "hierarchical"
    RADIAL = "radial"
    FLOWCHART = "flowchart"

class MindMapRequest(BaseModel):
    user_id: str
    topic: str = Field(..., min_length=1, max_length=200)
    depth: int = Field(default=3, ge=1, le=5)
    style: MindMapStyle = MindMapStyle.HIERARCHICAL

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "user_123",
                "topic": "Machine Learning",
                "depth": 3,
                "style": "hierarchical"
            }
        }

class MindMapResponse(BaseModel):
    mind_map: Dict[str, Any]
    mermaid_code: str
    credits_used: float
