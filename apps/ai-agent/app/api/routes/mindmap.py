"""
FastAPI route for mindmap generation
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.services.langchain_service import langchain_service

router = APIRouter()


class MindmapRequest(BaseModel):
    topic: str
    userId: Optional[str] = "anonymous"
    collection_name: Optional[str] = "default"
    diagram_type: Optional[str] = "mindmap"
    detail_level: Optional[int] = 3
    research: Optional[bool] = True
    systemPrompt: Optional[str] = None


@router.post("/")
async def generate_mindmap(req: MindmapRequest):
    if not req.topic:
        raise HTTPException(status_code=400, detail="Topic is required")

    try:
        # Map frontend 'default' collection to userId namespace if needed
        namespace = req.userId if req.collection_name == "default" else req.collection_name

        result = await langchain_service.generate_research_mindmap(
            topic=req.topic,
            depth=req.detail_level,
            diagram_type=req.diagram_type,
            custom_prompt=req.systemPrompt
            # LangChainService handles retrieval internally using 'default' namespace or we could pass namespace
        )
        
        # result is {"mermaidCode": "...", "themeVars": {...}}
        return {
            "mermaid_code": result.get("mermaidCode", ""),
            "themeVars": result.get("themeVars", {}),
            "diagram_type": req.diagram_type,
            "detail_level": req.detail_level
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
