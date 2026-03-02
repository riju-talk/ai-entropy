"""
NOVYRA — Pydantic schemas for the Knowledge Graph service
"""
from __future__ import annotations
from typing import List, Optional
from pydantic import BaseModel, Field


class ConceptNode(BaseModel):
    name: str = Field(..., description="Unique concept identifier")
    description: Optional[str] = None
    domain: Optional[str] = None   # e.g. "Mathematics", "Programming"
    difficulty: Optional[int] = Field(None, ge=1, le=5)


class PrerequisiteLink(BaseModel):
    concept: str
    prerequisite: str


class ConceptContextResponse(BaseModel):
    """Returned when the reasoning engine fetches graph context."""
    concept: str
    prerequisites: List[str] = []
    related: List[str] = []
    mastery_hints: List[str] = []


class UserWeakNodesResponse(BaseModel):
    user_id: str
    weak_nodes: List[str]
    recommended_path: List[str] = []


class AddConceptRequest(BaseModel):
    node: ConceptNode


class AddPrerequisiteRequest(BaseModel):
    concept: str
    prerequisite: str
