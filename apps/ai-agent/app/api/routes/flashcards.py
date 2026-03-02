"""
Flashcard Generation Endpoint — Clean Version
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from app.services.langchain_service import langchain_service

router = APIRouter()

class FlashcardRequest(BaseModel):
    topic: str
    userId: Optional[str] = "anonymous"
    collection_name: Optional[str] = "default"
    count: Optional[int] = 10
    customPrompt: Optional[str] = None


@router.post("/")
async def generate_flashcards(req: FlashcardRequest):
    topic = req.topic.strip()

    if not topic:
        raise HTTPException(status_code=400, detail="Topic cannot be empty")

    count = max(1, min(req.count or 10, 50))

    try:
        namespace = req.userId if req.collection_name == "default" else req.collection_name
        
        cards = await langchain_service.generate_flashcards(
            topic=topic,
            count=count,
            custom_prompt=req.customPrompt,
            collection_name=namespace
        )

        if not cards:
            raise RuntimeError("No flashcards generated")

        return {
            "flashcards": cards,
            "count": len(cards)
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Flashcard generation failed: {str(e)}"
        )
