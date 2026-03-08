"""
Quiz Generation Endpoint — Full 6-type assessment + MCQ-only mode

Supports six question types that match quiz-agent.tsx exactly:
  single_correct   — 4-option MCQ, one correct answer (correctAnswer: int)
  multiple_correct — 4-option MCQ, multiple correct (correctAnswers: int[])
  fill_blank       — sentence with ___ gaps (blanks: str[])
  true_false       — declarative statement (correct: bool)
  short_answer     — open response (sampleAnswer, rubricKeywords)
  long_answer      — essay (sampleAnswer, rubricCriteria[{criterion,points}])

When question_types has >1 type → full assessment prompt.
When question_types is empty / single type → MCQ-only prompt (exam mode).
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, model_validator
from typing import Optional, List, Any, Dict
import logging

from app.core.llm import generate_json

router = APIRouter()
logger = logging.getLogger(__name__)

# ─── System prompt ────────────────────────────────────────────────────────────

_QUIZ_SYSTEM = (
    "You are an expert university educator building rigorous, accurate assessments. "
    "Always return strictly valid JSON with no markdown fences and no prose outside the JSON."
)

# ─── MCQ-only prompt (exam-mode / single-type) ────────────────────────────────

_MCQ_ONLY_PROMPT = """Generate {count} multiple-choice questions about: {topic}

Difficulty: {difficulty}
{custom_section}

Return ONLY this JSON (no markdown, no backticks):
{{
  "questions": [
    {{
      "type": "single_correct",
      "question": "Specific, unambiguous question text?",
      "options": ["Plausible option A", "Plausible option B", "Plausible option C", "Plausible option D"],
      "correctAnswer": 0,
      "explanation": "Why this is correct and why the main distractor is wrong."
    }}
  ]
}}

Rules:
- correctAnswer is 0-based integer index (0-3)
- Exactly 4 options per question; distractors must be plausible
- Difficulty: easy=recall, medium=apply/understand, hard=analyse/evaluate/create
- explanation must clearly justify the correct answer
"""

# ─── Full-assessment prompt (all 6 types) ─────────────────────────────────────

_FULL_ASSESSMENT_PROMPT = """Generate a full academic assessment about: {topic}

Difficulty: {difficulty}
Total questions: {count}
Question types to include (distribute evenly): {types_list}
{custom_section}

Return ONLY this JSON — no markdown, no backticks, no extra keys:
{{
  "questions": [
    {{
      "type": "single_correct",
      "question": "Specific question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 1,
      "explanation": "Option B is correct because... Option A is wrong because..."
    }},
    {{
      "type": "multiple_correct",
      "question": "Select ALL statements that correctly describe [concept]. More than one may be correct.",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswers": [0, 2],
      "explanation": "Options A and C are correct because... B and D are wrong because..."
    }},
    {{
      "type": "fill_blank",
      "question": "The [key concept] of {topic} is defined as ___, and its primary role involves ___.",
      "blanks": ["correct answer for first blank", "correct answer for second blank"],
      "explanation": "First blank: [answer] — because... Second blank: [answer] — because..."
    }},
    {{
      "type": "true_false",
      "question": "A precise declarative statement about {topic} that is either clearly true or clearly false.",
      "correct": true,
      "explanation": "This is true/false because [specific factual justification]."
    }},
    {{
      "type": "short_answer",
      "question": "In 2-3 sentences, explain [specific aspect of {topic}] and its significance.",
      "sampleAnswer": "A model 2-3 sentence answer covering definition, mechanism, and significance.",
      "rubricKeywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
      "explanation": "Full marks: correct definition + significance + example. Partial: definition only."
    }},
    {{
      "type": "long_answer",
      "question": "Write a structured response (300-500 words) on {topic} covering: (a) definition and context, (b) core principles or mechanisms, (c) real-world examples, (d) limitations or future directions.",
      "sampleAnswer": "A strong answer opens with a precise definition, explains core mechanisms with clarity, gives at least one concrete example, and reflects on significance and trade-offs.",
      "rubricCriteria": [
        {{"criterion": "Accurate definition and contextualisation", "points": 2}},
        {{"criterion": "Explanation of core principles or mechanisms", "points": 3}},
        {{"criterion": "Concrete, well-chosen examples or applications", "points": 2}},
        {{"criterion": "Critical analysis, limitations or future directions", "points": 2}},
        {{"criterion": "Logical structure, clarity and academic tone", "points": 1}}
      ],
      "explanation": "Apply rubric criteria systematically. Reward conceptual depth over rote recall."
    }}
  ]
}}

CRITICAL RULES:
- Include only the types listed in 'Question types to include'; omit others
- single_correct: correctAnswer is a single 0-based integer
- multiple_correct: correctAnswers is an array of 0-based integers (2-3 correct answers)
- fill_blank: use ___ in question text for each blank; blanks array has one answer per blank
- true_false: question is a factual declarative statement; correct is a JSON boolean
- short_answer: rubricKeywords has 4-6 content words the answer should contain
- long_answer: rubricCriteria items must sum to roughly 10 points total
- All explanations must be educational and specifically justify the correct answer
- Difficulty: easy=recall, medium=apply/understand, hard=analyse/evaluate/create
"""

# ─── Allowed types ────────────────────────────────────────────────────────────

_VALID_TYPES = frozenset({
    "single_correct", "multiple_correct", "fill_blank",
    "true_false", "short_answer", "long_answer",
})

# ─── Schema ───────────────────────────────────────────────────────────────────

class QuizRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=300)
    num_questions: Optional[int] = None
    numQuestions: Optional[int] = None       # camelCase legacy alias
    difficulty: Optional[str] = "medium"
    question_types: Optional[List[str]] = None
    userId: Optional[str] = "anonymous"
    customPrompt: Optional[str] = None
    system_prompt: Optional[str] = None

    @model_validator(mode="after")
    def resolve_count(self) -> "QuizRequest":
        if not self.num_questions:
            self.num_questions = self.numQuestions or 5
        return self


# ─── Per-type normalisation ───────────────────────────────────────────────────

def _normalise(item: Any) -> Optional[Dict]:
    """Validate and normalise one raw LLM question dict. Returns None if unfixable."""
    if not isinstance(item, dict):
        return None
    qtype = item.get("type", "single_correct")
    question = (item.get("question") or "").strip()
    if not question:
        return None

    if qtype == "single_correct":
        options = list(item.get("options") or [])[:4]
        if len(options) < 2:
            return None
        correct = item.get("correctAnswer", 0)
        if not isinstance(correct, int) or not (0 <= correct < len(options)):
            correct = 0
        return {
            "type": "single_correct",
            "question": question,
            "options": options,
            "correctAnswer": correct,
            "explanation": item.get("explanation") or "",
        }

    if qtype == "multiple_correct":
        options = list(item.get("options") or [])[:4]
        if len(options) < 2:
            return None
        idxs = [i for i in (item.get("correctAnswers") or [])
                if isinstance(i, int) and 0 <= i < len(options)]
        if not idxs:
            idxs = [0]
        return {
            "type": "multiple_correct",
            "question": question,
            "options": options,
            "correctAnswers": idxs,
            "explanation": item.get("explanation") or "",
        }

    if qtype == "fill_blank":
        blanks = list(item.get("blanks") or [])
        if not blanks:
            return None
        return {
            "type": "fill_blank",
            "question": question,
            "blanks": [str(b) for b in blanks],
            "explanation": item.get("explanation") or "",
        }

    if qtype == "true_false":
        correct = item.get("correct")
        if not isinstance(correct, bool):
            correct = True
        return {
            "type": "true_false",
            "question": question,
            "correct": correct,
            "explanation": item.get("explanation") or "",
        }

    if qtype == "short_answer":
        return {
            "type": "short_answer",
            "question": question,
            "sampleAnswer": item.get("sampleAnswer") or "",
            "rubricKeywords": list(item.get("rubricKeywords") or []),
            "explanation": item.get("explanation") or "",
        }

    if qtype == "long_answer":
        criteria = list(item.get("rubricCriteria") or [])
        return {
            "type": "long_answer",
            "question": question,
            "sampleAnswer": item.get("sampleAnswer") or "",
            "rubricCriteria": [
                {"criterion": str(c.get("criterion", "")), "points": int(c.get("points", 1))}
                for c in criteria if isinstance(c, dict)
            ],
            "explanation": item.get("explanation") or "",
        }

    # Unknown type — coerce to single_correct if options exist
    options = list(item.get("options") or [])[:4]
    if options:
        correct = item.get("correctAnswer", 0)
        if not isinstance(correct, int) or not (0 <= correct < len(options)):
            correct = 0
        return {
            "type": "single_correct",
            "question": question,
            "options": options,
            "correctAnswer": correct,
            "explanation": item.get("explanation") or "",
        }

    return None


# ─── Endpoint ─────────────────────────────────────────────────────────────────

@router.post("/")
async def generate_quiz(req: QuizRequest):
    topic = req.topic.strip()
    if not topic:
        raise HTTPException(status_code=400, detail="Topic cannot be empty")

    count = max(1, min(req.num_questions or 5, 30))
    difficulty = (req.difficulty or "medium").lower().strip()
    custom_section = f"Additional instructions: {req.customPrompt}" if req.customPrompt else ""

    requested_types = [t for t in (req.question_types or []) if t in _VALID_TYPES]
    is_full = len(requested_types) > 1

    if is_full:
        prompt = _FULL_ASSESSMENT_PROMPT.format(
            topic=topic,
            difficulty=difficulty,
            count=count,
            types_list=", ".join(requested_types),
            custom_section=custom_section,
        )
    else:
        prompt = _MCQ_ONLY_PROMPT.format(
            topic=topic,
            difficulty=difficulty,
            count=count,
            custom_section=custom_section,
        )

    try:
        raw: dict = await generate_json(prompt, system_prompt=req.system_prompt or _QUIZ_SYSTEM)
        raw_questions = raw.get("questions", [])

        if not raw_questions:
            raise RuntimeError("LLM returned an empty questions list")

        questions = []
        for item in raw_questions[:count]:
            normalised = _normalise(item)
            if normalised:
                questions.append(normalised)

        if not questions:
            raise RuntimeError("No valid questions after normalisation")

        logger.info(
            "Quiz generated: topic=%s count=%d difficulty=%s types=%s",
            topic, len(questions), difficulty, requested_types or ["single_correct"],
        )
        return {"questions": questions, "count": len(questions)}

    except Exception as exc:
        logger.exception("Quiz generation failed for topic=%s: %s", topic, exc)
        raise HTTPException(
            status_code=500,
            detail=f"Quiz generation failed: {str(exc)}",
        )
