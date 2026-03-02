"""
NOVYRA AI Brain - Layer 3: Knowledge Graph Traversal

Traverses Neo4j knowledge graph to build context around concepts.
Reference: docs/AI_BRAIN_ARCHITECTURE.md Layer 3
"""
import logging
from typing import List, Optional, Dict, Any
from dataclasses import dataclass

from app.services.knowledge_graph_service import get_driver

logger = logging.getLogger(__name__)


@dataclass
class GraphContext:
    """Rich context assembled from knowledge graph."""
    concept_id: str
    concept_name: str
    description: Optional[str]
    difficulty: int
    prerequisites: List[Dict[str, Any]]  # [{name, id, mastered}]
    related_concepts: List[Dict[str, Any]]
    dependent_concepts: List[Dict[str, Any]]  # What depends on this
    depth_in_tree: int
    learning_path: List[str]  # Suggested order


async def traverse_prerequisites(
    concept_id: str,
    user_id: Optional[str] = None,
    max_depth: int = 3
) -> List[Dict[str, Any]]:
    """
    Find all prerequisite concepts using graph traversal.
    
    Returns concepts ordered by distance (closest first).
    Includes user's mastery status if user_id provided.
    
    Args:
        concept_id: Starting concept node ID
        user_id: Optional user ID to fetch mastery data
        max_depth: Maximum traversal depth
    
    Returns:
        List of prerequisite dicts with {id, name, distance, mastered}
    """
    driver = get_driver()
    if driver is None:
        return []
    
    try:
        # Cypher query: traverse REQUIRES relationships
        query = """
        MATCH path = (c:Concept {id: $concept_id})-[:REQUIRES*1..{max_depth}]->(prereq:Concept)
        WITH prereq, length(path) as distance
        ORDER BY distance
        RETURN DISTINCT prereq.id AS id,
               prereq.name AS name,
               prereq.description AS description,
               prereq.difficulty AS difficulty,
               distance
        """.replace("{max_depth}", str(max_depth))
        
        async with driver.session() as session:
            result = await session.run(query, concept_id=concept_id)
            records = await result.data()
        
        prerequisites = []
        for record in records:
            prereq = {
                "id": record["id"],
                "name": record["name"],
                "description": record["description"],
                "difficulty": record["difficulty"],
                "distance": record["distance"],
                "mastered": False  # Default
            }
            
            # Check if user has mastered this prerequisite
            if user_id:
                from app.core.database import get_db
                try:
                    db = get_db()
                    mastery = await db.mastery_record.find_first({
                        "where": {
                            "userId": user_id,
                            "conceptId": record["id"]
                        }
                    })
                    if mastery and mastery.masteryScore >= 0.7:
                        prereq["mastered"] = True
                except Exception as e:
                    logger.error(f"Failed to fetch mastery for concept {record['id']}: {e}")
            
            prerequisites.append(prereq)
        
        logger.info(f"Found {len(prerequisites)} prerequisites for concept {concept_id}")
        return prerequisites
    
    except Exception as e:
        logger.error(f"Failed to traverse prerequisites: {e}")
        return []


async def find_related_concepts(
    concept_id: str,
    max_results: int = 5
) -> List[Dict[str, Any]]:
    """
    Find concepts related to the given concept.
    
    Uses RELATED_TO relationships in the graph.
    
    Args:
        concept_id: Concept node ID
        max_results: Maximum number of results
    
    Returns:
        List of related concept dicts
    """
    driver = get_driver()
    if driver is None:
        return []
    
    try:
        query = """
        MATCH (c:Concept {id: $concept_id})-[:RELATED_TO]-(related:Concept)
        RETURN DISTINCT related.id AS id,
               related.name AS name,
               related.description AS description,
               related.difficulty AS difficulty
        LIMIT $max_results
        """
        
        async with driver.session() as session:
            result = await session.run(query, concept_id=concept_id, max_results=max_results)
            records = await result.data()
        
        related = [
            {
                "id": r["id"],
                "name": r["name"],
                "description": r["description"],
                "difficulty": r["difficulty"]
            }
            for r in records
        ]
        
        logger.info(f"Found {len(related)} related concepts for {concept_id}")
        return related
    
    except Exception as e:
        logger.error(f"Failed to find related concepts: {e}")
        return []


async def find_dependent_concepts(
    concept_id: str,
    max_results: int = 5
) -> List[Dict[str, Any]]:
    """
    Find concepts that depend on (require) this concept.
    
    Shows "what's next" after mastering this concept.
    
    Args:
        concept_id: Concept node ID
        max_results: Maximum number of results
    
    Returns:
        List of dependent concept dicts
    """
    driver = get_driver()
    if driver is None:
        return []
    
    try:
        query = """
        MATCH (dependent:Concept)-[:REQUIRES]->(c:Concept {id: $concept_id})
        RETURN DISTINCT dependent.id AS id,
               dependent.name AS name,
               dependent.description AS description,
               dependent.difficulty AS difficulty
        LIMIT $max_results
        """
        
        async with driver.session() as session:
            result = await session.run(query, concept_id=concept_id, max_results=max_results)
            records = await result.data()
        
        dependents = [
            {
                "id": r["id"],
                "name": r["name"],
                "description": r["description"],
                "difficulty": r["difficulty"]
            }
            for r in records
        ]
        
        logger.info(f"Found {len(dependents)} dependent concepts for {concept_id}")
        return dependents
    
    except Exception as e:
        logger.error(f"Failed to find dependent concepts: {e}")
        return []


async def compute_learning_path(
    concept_id: str,
    user_id: Optional[str] = None
) -> List[str]:
    """
    Compute optimal learning path to reach target concept.
    
    Uses topological sort on prerequisite graph.
    Considers user's current mastery.
    
    Args:
        concept_id: Target concept
        user_id: Optional user to personalize path
    
    Returns:
        Ordered list of concept IDs (start → target)
    """
    driver = get_driver()
    if driver is None:
        return [concept_id]
    
    try:
        # Get all prerequisites and their relationships
        query = """
        MATCH path = (c:Concept {id: $concept_id})-[:REQUIRES*0..]->(prereq:Concept)
        RETURN DISTINCT prereq.id AS id, length(path) as distance
        ORDER BY distance DESC
        """
        
        async with driver.session() as session:
            result = await session.run(query, concept_id=concept_id)
            records = await result.data()
        
        # Simple path: order by distance (furthest prerequisites first)
        path = [r["id"] for r in records]
        
        # Filter out already mastered concepts if user provided
        if user_id:
            from app.core.database import get_db
            try:
                db = get_db()
                mastery_records = await db.mastery_record.find_many({
                    "where": {
                        "userId": user_id,
                        "conceptId": {"in": path},
                        "masteryScore": {"gte": 0.7}
                    }
                })
                mastered_ids = {m.conceptId for m in mastery_records}
                
                # Keep only non-mastered concepts
                path = [cid for cid in path if cid not in mastered_ids or cid == concept_id]
            
            except Exception as e:
                logger.error(f"Failed to filter mastered concepts: {e}")
        
        logger.info(f"Computed learning path with {len(path)} steps")
        return path
    
    except Exception as e:
        logger.error(f"Failed to compute learning path: {e}")
        return [concept_id]


async def build_graph_context(
    concept_id: str,
    user_id: Optional[str] = None
) -> GraphContext:
    """
    Build comprehensive graph context for a concept.
    
    Combines all graph traversal operations into one rich context object.
    
    Args:
        concept_id: Target concept ID
        user_id: Optional user for personalization
    
    Returns:
        GraphContext with all relevant graph information
    """
    driver = get_driver()
    if driver is None:
        return GraphContext(
            concept_id=concept_id,
            concept_name="Unknown",
            description=None,
            difficulty=5,
            prerequisites=[],
            related_concepts=[],
            dependent_concepts=[],
            depth_in_tree=0,
            learning_path=[concept_id]
        )
    
    try:
        # Get concept details
        query = """
        MATCH (c:Concept {id: $concept_id})
        RETURN c.name AS name, c.description AS description, c.difficulty AS difficulty
        """
        
        async with driver.session() as session:
            result = await session.run(query, concept_id=concept_id)
            record = await result.single()
        
        if not record:
            raise ValueError(f"Concept {concept_id} not found in graph")
        
        # Gather all context in parallel
        import asyncio
        prerequisites, related, dependents, learning_path = await asyncio.gather(
            traverse_prerequisites(concept_id, user_id),
            find_related_concepts(concept_id),
            find_dependent_concepts(concept_id),
            compute_learning_path(concept_id, user_id)
        )
        
        context = GraphContext(
            concept_id=concept_id,
            concept_name=record["name"],
            description=record["description"],
            difficulty=record["difficulty"] or 5,
            prerequisites=prerequisites,
            related_concepts=related,
            dependent_concepts=dependents,
            depth_in_tree=len(prerequisites),
            learning_path=learning_path
        )
        
        logger.info(f"Built graph context for {record['name']}")
        return context
    
    except Exception as e:
        logger.error(f"Failed to build graph context: {e}")
        # Return minimal context
        return GraphContext(
            concept_id=concept_id,
            concept_name="Unknown",
            description=None,
            difficulty=5,
            prerequisites=[],
            related_concepts=[],
            dependent_concepts=[],
            depth_in_tree=0,
            learning_path=[concept_id]
        )


logger.info("Graph traversal initialized")
