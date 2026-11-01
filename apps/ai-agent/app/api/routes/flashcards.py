"""Flashcard generation: topic -> list of {front, back} cards."""

import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.llm import generate_json

router = APIRouter()
logger = logging.getLogger(__name__)

_SYSTEM = (
    "You are an expert teacher who writes concise, accurate study flashcards. "
    "Return strictly valid JSON with no markdown fences and no prose outside the JSON."
)

_PROMPT = """Create {count} flashcards about: {topic}
{custom_section}
Return ONLY this JSON:
{{"flashcards": [{{"front": "A clear question or term", "back": "A short, correct answer or definition"}}]}}

Rules:
- Each card tests exactly one idea; the front must be answerable without seeing other cards.
- Keep the back under 40 words; include a formula or example only when it helps recall.
- Vary the cards: definitions, why/how questions, and small worked examples.
"""


class FlashcardRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=300)
    count: int = Field(default=10, ge=1, le=50)
    customPrompt: Optional[str] = Field(default=None, max_length=1000)


class Flashcard(BaseModel):
    front: str
    back: str


class FlashcardResponse(BaseModel):
    flashcards: List[Flashcard]


@router.post("/", response_model=FlashcardResponse)
async def generate_flashcards(req: FlashcardRequest):
    topic = req.topic.strip()
    if not topic:
        raise HTTPException(status_code=400, detail="Topic cannot be empty")

    custom = f"\nAdditional instructions: {req.customPrompt.strip()}\n" if req.customPrompt else ""
    prompt = _PROMPT.format(count=req.count, topic=topic, custom_section=custom)

    raw = await generate_json(prompt, system_prompt=_SYSTEM)
    cards = []
    for item in (raw.get("flashcards") or []) if isinstance(raw, dict) else []:
        front = str(item.get("front", "")).strip() if isinstance(item, dict) else ""
        back = str(item.get("back", "")).strip() if isinstance(item, dict) else ""
        if front and back:
            cards.append(Flashcard(front=front, back=back))

    if not cards:
        logger.error("Flashcard generation returned no usable cards for topic=%r", topic)
        raise HTTPException(status_code=502, detail="The model returned no flashcards. Please try again.")
    return FlashcardResponse(flashcards=cards[: req.count])
