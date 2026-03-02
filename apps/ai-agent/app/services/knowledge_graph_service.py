"""
NOVYRA — Knowledge Graph Service (Neo4j)

This is the brain of NOVYRA. Every concept lives as a node.
Prerequisites, mastery, and relationships are graph edges.

Node labels:  Concept, User
Relationships: PREREQUISITE_OF, PART_OF, ATTEMPTED_BY, MASTERED_BY
"""
from __future__ import annotations
import logging
from typing import List, Optional

from neo4j import AsyncGraphDatabase, AsyncDriver
from neo4j.exceptions import ServiceUnavailable

from app.core.config import settings

logger = logging.getLogger(__name__)

_driver: Optional[AsyncDriver] = None


async def get_driver() -> AsyncDriver:
    global _driver
    if _driver is None:
        _driver = AsyncGraphDatabase.driver(
            settings.NEO4J_URI,
            auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
        )
        logger.info("Neo4j driver initialised → %s", settings.NEO4J_URI)
    return _driver


async def close_driver() -> None:
    global _driver
    if _driver:
        await _driver.close()
        _driver = None
        logger.info("Neo4j driver closed")


# ---------------------------------------------------------------------------
# Concept management
# ---------------------------------------------------------------------------

async def add_concept(
    name: str,
    description: str = "",
    domain: str = "",
    difficulty: int = 1,
) -> dict:
    """Create or update a Concept node."""
    driver = await get_driver()
    async with driver.session() as session:
        result = await session.run(
            """
            MERGE (c:Concept {name: $name})
            ON CREATE SET
                c.description = $description,
                c.domain = $domain,
                c.difficulty = $difficulty,
                c.created_at = timestamp()
            ON MATCH SET
                c.description = COALESCE($description, c.description),
                c.domain = COALESCE($domain, c.domain)
            RETURN c
            """,
            name=name,
            description=description,
            domain=domain,
            difficulty=difficulty,
        )
        record = await result.single()
        return dict(record["c"]) if record else {}


async def link_prerequisite(concept: str, prerequisite: str) -> bool:
    """
    Create: (prerequisite)-[:PREREQUISITE_OF]->(concept)
    Meaning: you must know `prerequisite` before learning `concept`.
    """
    driver = await get_driver()
    async with driver.session() as session:
        await session.run(
            """
            MATCH (pre:Concept {name: $pre}), (con:Concept {name: $con})
            MERGE (pre)-[:PREREQUISITE_OF]->(con)
            """,
            pre=prerequisite,
            con=concept,
        )
    logger.debug("Linked prerequisite: %s → %s", prerequisite, concept)
    return True


# ---------------------------------------------------------------------------
# Context retrieval for reasoning engine
# ---------------------------------------------------------------------------

async def fetch_concept_context(concept: str) -> dict:
    """
    Return the concept's direct prerequisites and sibling concepts.
    Used by the reasoning engine to enrich prompts.
    """
    driver = await get_driver()
    async with driver.session() as session:
        result = await session.run(
            """
            OPTIONAL MATCH (pre:Concept)-[:PREREQUISITE_OF]->(c:Concept {name: $name})
            OPTIONAL MATCH (c)-[:PART_OF]->(parent:Concept)
            OPTIONAL MATCH (sibling:Concept)-[:PART_OF]->(parent)
              WHERE sibling.name <> $name
            RETURN
                collect(DISTINCT pre.name)  AS prerequisites,
                collect(DISTINCT sibling.name)[0..5] AS related
            """,
            name=concept,
        )
        record = await result.single()
        if record:
            return {
                "concept": concept,
                "prerequisites": record["prerequisites"],
                "related": record["related"],
            }
        return {"concept": concept, "prerequisites": [], "related": []}


# ---------------------------------------------------------------------------
# User mastery
# ---------------------------------------------------------------------------

async def record_mastery(user_id: str, concept: str, mastery_score: float) -> None:
    """
    Store or update MASTERED_BY relationship with a score property.
    Score is float 0-1.
    """
    driver = await get_driver()
    async with driver.session() as session:
        await session.run(
            """
            MERGE (u:User {id: $user_id})
            MERGE (c:Concept {name: $concept})
            MERGE (u)-[r:MASTERED_BY]->(c)
            SET r.score = $score, r.updated_at = timestamp()
            """,
            user_id=user_id,
            concept=concept,
            score=mastery_score,
        )


async def get_user_weak_nodes(user_id: str, threshold: float = 0.5) -> List[str]:
    """
    Return concepts where the user's mastery score is below `threshold`,
    ordered by difficulty (hardest first so they tackle blockers).
    """
    driver = await get_driver()
    async with driver.session() as session:
        result = await session.run(
            """
            MATCH (u:User {id: $user_id})-[r:MASTERED_BY]->(c:Concept)
            WHERE r.score < $threshold
            RETURN c.name AS concept, r.score AS score
            ORDER BY r.score ASC
            LIMIT 10
            """,
            user_id=user_id,
            threshold=threshold,
        )
        records = await result.data()
        return [r["concept"] for r in records]


async def get_recommended_path(user_id: str, target_concept: str) -> List[str]:
    """
    Shortest prerequisite path from what the user knows to the target concept.
    Uses Neo4j shortestPath over PREREQUISITE_OF relationships.
    """
    driver = await get_driver()
    async with driver.session() as session:
        result = await session.run(
            """
            MATCH (target:Concept {name: $target})
            MATCH path = shortestPath(
                (start:Concept)-[:PREREQUISITE_OF*]->(target)
            )
            WHERE NOT EXISTS {
                MATCH (u:User {id: $user_id})-[r:MASTERED_BY]->(start)
                WHERE r.score >= 0.7
            }
            RETURN [n IN nodes(path) | n.name] AS path_nodes
            LIMIT 1
            """,
            target=target_concept,
            user_id=user_id,
        )
        record = await result.single()
        return record["path_nodes"] if record else [target_concept]


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

async def ping() -> bool:
    try:
        driver = await get_driver()
        async with driver.session() as session:
            await session.run("RETURN 1")
        return True
    except ServiceUnavailable:
        return False


async def count_concepts() -> int:
    """Return the number of Concept nodes in the graph."""
    try:
        driver = await get_driver()
        async with driver.session() as session:
            result = await session.run("MATCH (c:Concept) RETURN count(c) as count")
            record = await result.single()
            return record["count"] if record else 0
    except Exception:
        return 0


async def get_all_nodes(user_id: Optional[str] = None) -> dict:
    """
    Return all Concept nodes with optional per-user mastery scores,
    plus all PREREQUISITE_OF edges.

    Used by the LiveKnowledgeGraph frontend component.

    Returns:
        {
          "nodes": [{"id": str, "label": str, "mastery": float (0-100),
                     "domain": str, "difficulty": int}],
          "edges": [{"from": str, "to": str, "strength": float}]
        }
    """
    driver = await get_driver()
    nodes: list = []
    edges: list = []

    async with driver.session() as session:
        # Fetch all concept nodes with optional mastery scores
        if user_id:
            result = await session.run(
                """
                MATCH (c:Concept)
                OPTIONAL MATCH (u:User {id: $user_id})-[r:MASTERED_BY]->(c)
                RETURN c.name AS id,
                       c.name AS label,
                       COALESCE(r.score, 0.0) AS mastery_score,
                       COALESCE(c.domain, '') AS domain,
                       COALESCE(c.difficulty, 1) AS difficulty
                ORDER BY c.name
                """,
                user_id=user_id,
            )
        else:
            result = await session.run(
                """
                MATCH (c:Concept)
                RETURN c.name AS id,
                       c.name AS label,
                       0.0 AS mastery_score,
                       COALESCE(c.domain, '') AS domain,
                       COALESCE(c.difficulty, 1) AS difficulty
                ORDER BY c.name
                """
            )

        records = await result.data()
        for r in records:
            nodes.append({
                "id": r["id"],
                "label": r["label"],
                "mastery": round(float(r["mastery_score"]) * 100, 1),  # 0-100 scale
                "domain": r["domain"],
                "difficulty": r["difficulty"],
            })

        # Fetch all PREREQUISITE_OF edges
        edge_result = await session.run(
            """
            MATCH (pre:Concept)-[rel:PREREQUISITE_OF]->(con:Concept)
            RETURN pre.name AS from_node, con.name AS to_node,
                   COALESCE(rel.strength, 1.0) AS strength
            """
        )
        edge_records = await edge_result.data()
        for er in edge_records:
            edges.append({
                "from": er["from_node"],
                "to": er["to_node"],
                "strength": float(er["strength"]),
            })

    return {"nodes": nodes, "edges": edges}
