"""
Mindmap generation endpoint — Direct Gemini (no LangChain / no Pinecone)

Returns a Mermaid mindmap source string that the frontend renders directly.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import logging

from app.core.llm import generate_text
from app.core.prompts import MINDMAP_PROMPT

router = APIRouter()
logger = logging.getLogger(__name__)


class MindmapRequest(BaseModel):
    topic: str
    userId: Optional[str] = "anonymous"
    diagram_type: Optional[str] = "mindmap"
    detail_level: Optional[int] = 3
    systemPrompt: Optional[str] = None
    # Legacy field kept for backward compat; ignored
    collection_name: Optional[str] = "default"
    research: Optional[bool] = True


@router.post("/")
async def generate_mindmap(req: MindmapRequest):
    topic = req.topic.strip()
    if not topic:
        raise HTTPException(status_code=400, detail="Topic is required")

    depth_label = {1: "shallow", 2: "medium", 3: "detailed", 4: "deep", 5: "comprehensive"}.get(
        req.detail_level or 3, "detailed"
    )

    prompt = MINDMAP_PROMPT.format(topic=topic, depth=depth_label)

    # Allow caller to override system instruction
    system = req.systemPrompt or (
        "You are an expert educator. Output ONLY valid Mermaid mindmap source. "
        "No explanations, no code fences, no markdown."
    )

    try:
        mermaid_code = await generate_text(prompt, system_prompt=system, temperature=0.4)

        # Strip accidental code fences if the model adds them
        mermaid_code = mermaid_code.strip()
        for fence in ("```mermaid", "```", "~~~"):
            mermaid_code = mermaid_code.replace(fence, "").strip()

        logger.info("Mindmap generated for topic=%s (len=%d)", topic, len(mermaid_code))
        return {
            "mermaid_code": mermaid_code,
            "themeVars": {},
            "diagram_type": req.diagram_type,
            "detail_level": req.detail_level,
        }

    except Exception as exc:
        logger.exception("Mindmap generation failed for topic=%s: %s", topic, exc)
        raise HTTPException(status_code=500, detail=f"Mindmap generation failed: {str(exc)}")
