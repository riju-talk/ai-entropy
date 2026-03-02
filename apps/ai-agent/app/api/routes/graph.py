"""
NOVYRA — Knowledge Graph API Routes
POST /api/graph/concept        → add concept node
POST /api/graph/prerequisite   → link prerequisite
GET  /api/graph/nodes          → all nodes + edges (LiveKnowledgeGraph feed)
GET  /api/graph/context/{concept}        → fetch concept context
GET  /api/graph/weak/{user_id}           → get user weak nodes
GET  /api/graph/path/{user_id}/{concept} → recommended learning path
"""
from fastapi import APIRouter, HTTPException
from typing import Optional
import logging

from app.schemas.graph import (
    AddConceptRequest,
    AddPrerequisiteRequest,
    ConceptContextResponse,
    UserWeakNodesResponse,
)
from app.services import knowledge_graph_service as kg

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/concept", summary="Add a concept node to the Knowledge Graph")
async def add_concept(request: AddConceptRequest) -> dict:
    try:
        node = request.node
        result = await kg.add_concept(
            name=node.name,
            description=node.description or "",
            domain=node.domain or "",
            difficulty=node.difficulty or 1,
        )
        return {"status": "ok", "node": result}
    except Exception as exc:
        logger.exception("add_concept failed: %s", exc)
        raise HTTPException(status_code=500, detail="Graph write error")


@router.post("/prerequisite", summary="Link a prerequisite relationship")
async def add_prerequisite(request: AddPrerequisiteRequest) -> dict:
    try:
        await kg.link_prerequisite(request.concept, request.prerequisite)
        return {
            "status": "ok",
            "message": f"{request.prerequisite} → PREREQUISITE_OF → {request.concept}",
        }
    except Exception as exc:
        logger.exception("add_prerequisite failed: %s", exc)
        raise HTTPException(status_code=500, detail="Graph write error")


@router.get("/nodes", summary="All concept nodes + prerequisite edges (LiveKnowledgeGraph feed)")
async def get_all_nodes(user_id: Optional[str] = None) -> dict:
    """
    Returns every Concept node with mastery percentage (0-100) and all
    PREREQUISITE_OF edges.  Optionally scoped to a user's mastery scores.
    """
    try:
        return await kg.get_all_nodes(user_id=user_id)
    except Exception as exc:
        logger.exception("get_all_nodes failed: %s", exc)
        raise HTTPException(status_code=500, detail="Graph read error")


@router.get("/context/{concept}", response_model=ConceptContextResponse, summary="Get concept graph context")
async def get_context(concept: str) -> ConceptContextResponse:
    try:
        ctx = await kg.fetch_concept_context(concept)
        return ConceptContextResponse(**ctx)
    except Exception as exc:
        logger.exception("fetch_concept_context failed: %s", exc)
        raise HTTPException(status_code=500, detail="Graph read error")


@router.get("/weak/{user_id}", response_model=UserWeakNodesResponse, summary="Get user's weak concept nodes")
async def get_weak_nodes(user_id: str) -> UserWeakNodesResponse:
    try:
        weak = await kg.get_user_weak_nodes(user_id)
        return UserWeakNodesResponse(user_id=user_id, weak_nodes=weak)
    except Exception as exc:
        logger.exception("get_user_weak_nodes failed: %s", exc)
        raise HTTPException(status_code=500, detail="Graph read error")


@router.get("/path/{user_id}/{concept}", summary="Get recommended learning path to concept")
async def get_path(user_id: str, concept: str) -> dict:
    try:
        path = await kg.get_recommended_path(user_id, concept)
        return {"user_id": user_id, "target": concept, "path": path}
    except Exception as exc:
        logger.exception("get_recommended_path failed: %s", exc)
        raise HTTPException(status_code=500, detail="Graph read error")
