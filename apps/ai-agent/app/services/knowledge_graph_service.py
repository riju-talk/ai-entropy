"""
Entropy AI — Knowledge Graph Service (Neo4j)

This is the brain of Entropy AI. Every concept lives as a node.
Prerequisites, mastery, and relationships are graph edges.

Node labels:  Concept, User, Document
Relationships: PREREQUISITE_OF, PART_OF, ATTEMPTED_BY, MASTERED_BY, CONTAINS
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
        logger.info("Neo4j driver initialised â†’ %s", settings.NEO4J_URI)
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
    """Create or update a Concept node (name is always stored in English)."""
    # Normalise to English so the graph never contains non-Latin concept names.
    try:
        from app.services import multilingual_service as _ml
        name = await _ml.normalize_concept_to_english(name) or name
    except Exception:
        pass
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
    logger.debug("Linked prerequisite: %s â†’ %s", prerequisite, concept)
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
    Score is float 0-1.  Concept name is normalised to English.
    """
    try:
        from app.services import multilingual_service as _ml
        concept = await _ml.normalize_concept_to_english(concept) or concept
    except Exception:
        pass
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
# Document ↔ Concept tracking
# ---------------------------------------------------------------------------

async def link_document_concept(source: str, user_id: str, concept_name: str) -> None:
    """
    Create a Document node (keyed by source filename + user_id) and link it
    to a Concept via CONTAINS.  Used during upload so we can clean up the graph
    when the document is deleted.
    """
    driver = await get_driver()
    async with driver.session() as session:
        await session.run(
            """
            MERGE (d:Document {source: $source, user_id: $user_id})
            MERGE (c:Concept   {name: $concept})
            MERGE (d)-[:CONTAINS]->(c)
            """,
            source=source,
            user_id=user_id,
            concept=concept_name,
        )


async def remove_document_from_graph(source: str, user_id: str) -> dict:
    """
    Delete a Document node (and its CONTAINS edges).

    For every Concept that was exclusively provided by this document
    (i.e. no other Document CONTAINS it for this user), also remove the
    user's MASTERED_BY relationship to that concept.

    Global Concept nodes are kept — they benefit other users.

    Returns: {"removed_doc": bool, "cleaned_mastery": int}
    """
    driver = await get_driver()
    cleaned = 0
    removed = False
    try:
        async with driver.session() as session:
            # 1. Find concepts only this doc provides for this user
            result = await session.run(
                """
                MATCH (d:Document {source: $source, user_id: $user_id})-[:CONTAINS]->(c:Concept)
                WHERE NOT EXISTS {
                    MATCH (other:Document {user_id: $user_id})-[:CONTAINS]->(c)
                    WHERE other.source <> $source
                }
                RETURN c.name AS concept
                """,
                source=source,
                user_id=user_id,
            )
            exclusive_concepts = [r["concept"] async for r in result]

            # 2. Remove MASTERED_BY for those exclusive concepts
            if exclusive_concepts:
                res2 = await session.run(
                    """
                    MATCH (u:User {id: $user_id})-[r:MASTERED_BY]->(c:Concept)
                    WHERE c.name IN $concepts
                    DELETE r
                    RETURN count(r) AS cnt
                    """,
                    user_id=user_id,
                    concepts=exclusive_concepts,
                )
                record = await res2.single()
                cleaned = record["cnt"] if record else 0

            # 3. Delete the Document node (cascades CONTAINS edges)
            res3 = await session.run(
                """
                MATCH (d:Document {source: $source, user_id: $user_id})
                DETACH DELETE d
                RETURN count(d) AS cnt
                """,
                source=source,
                user_id=user_id,
            )
            r3 = await res3.single()
            removed = bool(r3 and r3["cnt"] > 0)

        logger.info(
            "[GRAPH] Removed doc '%s' for user %s — cleaned %d mastery edges",
            source, user_id, cleaned,
        )
    except Exception as exc:
        logger.warning("[GRAPH] remove_document_from_graph failed: %s", exc)

    return {"removed_doc": removed, "cleaned_mastery": cleaned}


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


async def get_concepts_matching_question(question: str) -> dict:
    """
    Find Concept nodes whose names appear in the question text, then return
    platform-wide aggregate stats (total learners, avg mastery, struggle rate).

    Used by the agentic RAG pipeline to inject collective learning intelligence
    into every AI answer — e.g. "73% of learners find this concept challenging."
    """
    try:
        driver = await get_driver()
        async with driver.session() as session:
            result = await session.run(
                """
                MATCH (c:Concept)
                WHERE toLower($question) CONTAINS toLower(c.name)
                WITH c LIMIT 5
                OPTIONAL MATCH (u:User)-[r:MASTERED_BY]->(c)
                RETURN c.name AS concept,
                       count(u) AS total_learners,
                       avg(COALESCE(r.score, 0.0)) AS avg_mastery,
                       sum(CASE WHEN r.score < 0.4 THEN 1 ELSE 0 END) AS struggling_count
                """,
                question=question,
            )
            records = await result.data()
            stats: dict = {}
            for r in records:
                total = int(r.get("total_learners") or 0)
                struggling = int(r.get("struggling_count") or 0)
                stats[r["concept"]] = {
                    "total_learners": total,
                    "avg_mastery": round(float(r["avg_mastery"] or 0) * 100, 1),
                    "struggle_rate": round(struggling / total * 100) if total > 0 else 0,
                }
            return stats
    except Exception as exc:
        logger.warning("get_concepts_matching_question failed: %s", exc)
        return {}


async def get_user_graph(user_id: str) -> dict:
    """
    Return only the Concept nodes the user has interacted with (via mastery records),
    plus PREREQUISITE_OF edges between those concepts.

    This gives a personalised graph showing only *what this user has learned*,
    rather than the full knowledge base.
    """
    # 1. Pull concept names from Prisma mastery records for this user
    from app.core.database import get_db
    concept_names: list[str] = []
    try:
        db = await get_db()
        records = await db.masteryrecord.find_many(
            where={"userId": user_id},
            include={"concept": True},
        )
        concept_names = [r.concept.name for r in records if r.concept]
    except Exception as exc:
        logger.warning("get_user_graph: Prisma query failed: %s", exc)

    if not concept_names:
        return {"nodes": [], "edges": []}

    driver = await get_driver()
    nodes: list = []
    edges: list = []

    async with driver.session() as session:
        # Fetch only the user's concepts with mastery scores
        result = await session.run(
            """
            MATCH (c:Concept)
            WHERE c.name IN $names
            OPTIONAL MATCH (u:User {id: $user_id})-[r:MASTERED_BY]->(c)
            RETURN c.name AS id,
                   c.name AS label,
                   COALESCE(r.score, 0.0) AS mastery_score,
                   COALESCE(c.domain, '') AS domain,
                   COALESCE(c.difficulty, 1) AS difficulty
            ORDER BY c.name
            """,
            names=concept_names,
            user_id=user_id,
        )
        records_data = await result.data()
        node_ids = set()
        for r in records_data:
            node_ids.add(r["id"])
            nodes.append({
                "id": r["id"],
                "label": r["label"],
                "mastery": round(float(r["mastery_score"]) * 100, 1),
                "domain": r["domain"],
                "difficulty": r["difficulty"],
            })

        # Fetch edges only between concepts the user has studied
        if node_ids:
            edge_result = await session.run(
                """
                MATCH (pre:Concept)-[rel:PREREQUISITE_OF]->(con:Concept)
                WHERE pre.name IN $names AND con.name IN $names
                RETURN pre.name AS from_node, con.name AS to_node,
                       COALESCE(rel.strength, 1.0) AS strength
                """,
                names=list(node_ids),
            )
            edge_records = await edge_result.data()
            for er in edge_records:
                edges.append({
                    "from": er["from_node"],
                    "to": er["to_node"],
                    "strength": float(er["strength"]),
                })

    return {"nodes": nodes, "edges": edges}


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
