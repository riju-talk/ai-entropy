"""
Quiz Generation Endpoint — Direct Gemini (no LangChain / no Pinecone)

Returns 4-option MCQs with correctAnswer index (0-3) that match the
quiz-agent.tsx frontend expectation exactly.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, model_validator
from typing import Optional, List
import logging

from app.core.llm import generate_json

router = APIRouter()
logger = logging.getLogger(__name__)

# ─── Prompt ──────────────────────────────────────────────────────────────────

_QUIZ_SYSTEM = (
    "You are an expert educator generating precise multiple-choice quiz questions. "
    "Always return strictly valid JSON with no code fences."
)

_QUIZ_PROMPT = """Generate a quiz about: {topic}

Difficulty: {difficulty}
Number of questions: {count}
{custom_section}

Return ONLY this JSON structure (no markdown, no backticks):
{{
  "questions": [
    {{
      "question": "Clear question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Concise educational explanation of the correct answer"
    }}
  ]
}}

Rules:
- correctAnswer is the 0-based index (0, 1, 2, or 3) of the correct option
- Provide exactly 4 options per question
- Distractors must be plausible but clearly wrong to experts
- Difficulty guide: easy = recall, medium = apply/understand, hard = analyse/evaluate/create
"""

# ─── Schema ───────────────────────────────────────────────────────────────────

class QuizRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=300)
    num_questions: Optional[int] = None    # snake_case (frontend sends this)
    numQuestions: Optional[int] = None     # camelCase legacy alias
    difficulty: Optional[str] = "medium"
    userId: Optional[str] = "anonymous"
    customPrompt: Optional[str] = None

    @model_validator(mode="after")
    def resolve_count(self) -> "QuizRequest":
        # Prefer snake_case; fall back to camelCase; default 5
        if not self.num_questions:
            self.num_questions = self.numQuestions or 5
        return self


class QuizQuestion(BaseModel):
    question: str
    options: List[str]
    correctAnswer: int
    explanation: str


# ─── Endpoint ─────────────────────────────────────────────────────────────────

@router.post("/")
async def generate_quiz(req: QuizRequest):
    topic = req.topic.strip()
    if not topic:
        raise HTTPException(status_code=400, detail="Topic cannot be empty")

    count = max(1, min(req.num_questions or 5, 20))
    difficulty = (req.difficulty or "medium").lower().strip()
    custom_section = f"Additional instructions: {req.customPrompt}" if req.customPrompt else ""

    prompt = _QUIZ_PROMPT.format(
        topic=topic,
        difficulty=difficulty,
        count=count,
        custom_section=custom_section,
    )

    try:
        raw: dict = await generate_json(prompt, system_prompt=_QUIZ_SYSTEM)
        raw_questions = raw.get("questions", [])

        if not raw_questions:
            raise RuntimeError("LLM returned an empty questions list")

        # Validate and normalise each question
        questions = []
        for item in raw_questions[:count]:
            options = item.get("options", [])
            correct = item.get("correctAnswer", 0)

            # Guard: ensure correctAnswer is in range
            if not isinstance(correct, int) or correct < 0 or correct >= len(options):
                correct = 0

            questions.append({
                "question": item.get("question", ""),
                "options": options[:4],          # max 4 options
                "correctAnswer": correct,
                "explanation": item.get("explanation", ""),
            })

        logger.info("Quiz generated: topic=%s count=%d difficulty=%s", topic, len(questions), difficulty)
        return {"questions": questions, "count": len(questions)}

    except Exception as exc:
        logger.exception("Quiz generation failed for topic=%s: %s", topic, exc)
        raise HTTPException(
            status_code=500,
            detail=f"Quiz generation failed: {str(exc)}"
        )
