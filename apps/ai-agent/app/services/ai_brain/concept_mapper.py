"""
NOVYRA AI Brain - Layer 2: Concept Mapping

Maps user questions to relevant concept nodes in the knowledge graph.
Reference: docs/AI_BRAIN_ARCHITECTURE.md Layer 2
"""
import logging
from typing import List, Optional
from dataclasses import dataclass

from app.core.llm import generate_json
from app.services.knowledge_graph_service import get_driver

logger = logging.getLogger(__name__)


@dataclass
class ConceptMatch:
    """A matched concept with confidence."""
    concept_name: str
    concept_id: Optional[str]
    confidence: float
    relevance_reason: str


CONCEPT_EXTRACTION_PROMPT = """Extract the main concepts from this question that would be represented in a CS/Math knowledge graph.

Question: {question}

Identify 1-3 core concepts. For each concept, provide:
- The concept name (e.g., "Binary Search", "Recursion", "Sorting Algorithms")
- Confidence (0.0-1.0) that this concept is relevant
- Why this concept is relevant to the question

Return JSON:
{{
  "concepts": [
    {{
      "name": "Concept Name",
      "confidence": 0.0-1.0,
      "relevance": "why this concept matters for this question"
    }}
  ]
}}

Focus on technical concepts, not general terms.
"""


async def extract_concepts_from_question(question: str) -> List[ConceptMatch]:
    """
    Extract concepts mentioned in a user question using LLM.
    
    Args:
        question: User's question text
    
    Returns:
        List of ConceptMatch objects with confidence scores
    """
    try:
        prompt = CONCEPT_EXTRACTION_PROMPT.format(question=question)
        
        result = await generate_json(
            prompt,
            system_prompt="You are an expert at identifying technical concepts in computer science and mathematics."
        )
        
        matches = []
        for concept_data in result.get("concepts", []):
            match = ConceptMatch(
                concept_name=concept_data["name"],
                concept_id=None,  # Will be resolved by graph lookup
                confidence=float(concept_data["confidence"]),
                relevance_reason=concept_data["relevance"]
            )
            matches.append(match)
        
        logger.info(f"Extracted {len(matches)} concepts from question")
        return matches
    
    except Exception as e:
        logger.error(f"Concept extraction failed: {e}")
        return []


async def resolve_concepts_to_graph(concept_matches: List[ConceptMatch]) -> List[ConceptMatch]:
    """
    Resolve extracted concept names to actual nodes in Neo4j knowledge graph.
    
    Uses fuzzy matching on concept names and synonyms.
    
    Args:
        concept_matches: Concepts extracted from question (no IDs yet)
    
    Returns:
        Same concepts but with concept_id filled in if found in graph
    """
    driver = get_driver()
    if driver is None:
        logger.warning("Neo4j driver not available - skipping graph resolution")
        return concept_matches
    
    resolved = []
    
    for match in concept_matches:
        try:
            # Query graph for matching concept (case-insensitive, check synonyms)
            query = """
            MATCH (c:Concept)
            WHERE toLower(c.name) = toLower($concept_name)
               OR $concept_name IN c.synonyms
            RETURN c.id AS concept_id, c.name AS name
            LIMIT 1
            """
            
            async with driver.session() as session:
                result = await session.run(query, concept_name=match.concept_name)
                record = await result.single()
                
                if record:
                    match.concept_id = record["concept_id"]
                    match.concept_name = record["name"]  # Use canonical name
                    logger.info(f"Resolved '{match.concept_name}' to graph node {match.concept_id}")
                else:
                    logger.warning(f"Concept '{match.concept_name}' not found in knowledge graph")
            
            resolved.append(match)
        
        except Exception as e:
            logger.error(f"Failed to resolve concept '{match.concept_name}': {e}")
            resolved.append(match)  # Include even if resolution failed
    
    return resolved


async def map_question_to_concepts(question: str) -> List[ConceptMatch]:
    """
    Complete concept mapping pipeline: extract + resolve.
    
    Args:
        question: User's question text
    
    Returns:
        List of ConceptMatch objects with graph IDs (if found)
    """
    # Step 1: Extract concepts using LLM
    extracted = await extract_concepts_from_question(question)
    
    if not extracted:
        return []
    
    # Step 2: Resolve to graph nodes
    resolved = await resolve_concepts_to_graph(extracted)
    
    # Sort by confidence (highest first)
    resolved.sort(key=lambda x: x.confidence, reverse=True)
    
    return resolved


async def get_primary_concept(question: str) -> Optional[ConceptMatch]:
    """
    Get the single most relevant concept for a question.
    
    Useful for mastery tracking (which concept is being practiced).
    
    Args:
        question: User's question text
    
    Returns:
        Highest-confidence concept or None
    """
    concepts = await map_question_to_concepts(question)
    
    if not concepts:
        return None
    
    return concepts[0]  # Highest confidence


logger.info("Concept mapper initialized")
