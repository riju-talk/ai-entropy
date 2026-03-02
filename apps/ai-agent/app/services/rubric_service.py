"""
NOVYRA — Rubric-Aware Evaluation Engine

No LangChain. Direct Gemini call with structured JSON enforcement.

Flow:
  1. Build rubric JSON string from request
  2. Call Gemini with RUBRIC_PROMPT
  3. Validate with Pydantic
  4. Compute weighted_total (guard against LLM arithmetic errors)
  5. Return EvaluationResponse
"""
from __future__ import annotations
import json
import logging

from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.llm import generate_json
from app.core.prompts import RUBRIC_SYSTEM, RUBRIC_PROMPT
from app.schemas.evaluation import EvaluationRequest, EvaluationResponse, CriterionScore

logger = logging.getLogger(__name__)


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=8))
async def evaluate(request: EvaluationRequest) -> EvaluationResponse:
    """
    Evaluate a student submission against a rubric.
    Returns a fully validated EvaluationResponse.
    """
    rubric_json = json.dumps(
        {"criteria": [c.model_dump() for c in request.rubric.criteria]},
        indent=2,
    )

    prompt = RUBRIC_PROMPT.format(
        submission=request.submission,
        rubric_json=rubric_json,
    )

    raw: dict = await generate_json(prompt, system_prompt=RUBRIC_SYSTEM)

    # Parse criterion scores
    criteria_raw = raw.get("criterion_scores", [])
    criterion_scores = [CriterionScore(**c) for c in criteria_raw]

    # Recompute weighted_total ourselves — don't trust LLM arithmetic
    weighted_total = sum(c.score * c.weight * 100 for c in criterion_scores)

    # Map grade level
    grade = _grade_from_score(weighted_total)

    return EvaluationResponse(
        criterion_scores=criterion_scores,
        weighted_total=round(weighted_total, 2),
        overall_feedback=raw.get("overall_feedback", ""),
        improvement_plan=raw.get("improvement_plan", []),
        grade_level=grade,
    )


def _grade_from_score(score: float) -> str:
    if score >= 85:
        return "Excellent"
    if score >= 70:
        return "Good"
    if score >= 50:
        return "Satisfactory"
    return "Needs Improvement"
