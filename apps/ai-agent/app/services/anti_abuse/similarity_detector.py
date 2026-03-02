"""
NOVYRA Anti-Abuse - Similarity Detector

Detects duplicate/plagiarized content using embedding similarity.
Reference: docs/TRUST_AND_ABUSE_MODEL.md
"""
import logging
import hashlib
from typing import List, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime, timedelta

from app.core.database import get_db

logger = logging.getLogger(__name__)


@dataclass
class SimilarityMatch:
    """Detected similarity match."""
    content_id: str
    content_type: str
    user_id: str
    similarity: float
    created_at: datetime


@dataclass
class SimilarityReport:
    """Similarity detection report."""
    is_duplicate: bool
    confidence: float
    matches: List[SimilarityMatch]
    recommendation: str  # "ALLOW", "WARN", "BLOCK"


# Thresholds
EXACT_MATCH_THRESHOLD = 0.98  # Near-identical content
HIGH_SIMILARITY_THRESHOLD = 0.90  # Very similar content
MODERATE_SIMILARITY_THRESHOLD = 0.75  # Potentially similar


async def compute_content_hash(text: str) -> str:
    """
    Compute SHA256 hash of normalized text.
    
    Used for exact duplicate detection.
    
    Args:
        text: The text to hash
    
    Returns:
        Hex digest of hash
    """
    # Normalize: lowercase, remove extra whitespace
    normalized = " ".join(text.lower().split())
    return hashlib.sha256(normalized.encode()).hexdigest()


async def compute_embedding(text: str) -> List[float]:
    """
    Compute semantic embedding for text.
    
    In production, would use sentence-transformers or OpenAI embeddings.
    For now, uses simple character n-gram approximation.
    
    Args:
        text: The text to embed
    
    Returns:
        Embedding vector (384 dimensions)
    """
    try:
        # Simple n-gram based embedding (placeholder)
        # In production: use sentence-transformers all-MiniLM-L6-v2
        from collections import Counter
        
        # Character trigrams
        trigrams = [text[i:i+3] for i in range(len(text) - 2)]
        trigram_counts = Counter(trigrams)
        
        # Convert to fixed-size vector (384 dims)
        embedding = [0.0] * 384
        for i, (trigram, count) in enumerate(trigram_counts.most_common(384)):
            embedding[i] = count / len(trigrams)
        
        return embedding
    
    except Exception as e:
        logger.error(f"Embedding computation failed: {e}")
        return [0.0] * 384


def cosine_similarity(a: List[float], b: List[float]) -> float:
    """
    Compute cosine similarity between two vectors.
    
    Args:
        a: First vector
        b: Second vector
    
    Returns:
        Similarity score (0.0 to 1.0)
    """
    try:
        import math
        
        dot_product = sum(x * y for x, y in zip(a, b))
        magnitude_a = math.sqrt(sum(x * x for x in a))
        magnitude_b = math.sqrt(sum(y * y for y in b))
        
        if magnitude_a == 0 or magnitude_b == 0:
            return 0.0
        
        return dot_product / (magnitude_a * magnitude_b)
    
    except Exception as e:
        logger.error(f"Cosine similarity failed: {e}")
        return 0.0


async def store_content_embedding(
    content_id: str,
    content_type: str,
    user_id: str,
    text: str,
    embedding: List[float],
    content_hash: str
) -> None:
    """
    Store content embedding in database.
    
    Args:
        content_id: ID of the content
        content_type: "answer", "doubt", etc.
        user_id: User who created content
        text: The text content
        embedding: Embedding vector
        content_hash: SHA256 hash
    """
    try:
        db = get_db()
        
        await db.content_embedding.upsert({
            "where": {
                "contentId_contentType": {
                    "contentId": content_id,
                    "contentType": content_type
                }
            },
            "create": {
                "contentId": content_id,
                "contentType": content_type,
                "userId": user_id,
                "embedding": embedding,
                "contentHash": content_hash,
                "textLength": len(text)
            },
            "update": {
                "embedding": embedding,
                "contentHash": content_hash,
                "textLength": len(text),
                "updatedAt": datetime.utcnow()
            }
        })
        
        logger.info(f"Stored embedding for {content_type} {content_id}")
    
    except Exception as e:
        logger.error(f"Failed to store embedding: {e}")


async def find_similar_content(
    embedding: List[float],
    content_hash: str,
    content_type: str,
    limit: int = 10,
    lookback_days: int = 90
) -> List[SimilarityMatch]:
    """
    Find similar content in database.
    
    Args:
        embedding: Query embedding
        content_hash: Query content hash
        content_type: Type of content to search
        limit: Maximum matches to return
        lookback_days: Search window in days
    
    Returns:
        List of similarity matches
    """
    try:
        db = get_db()
        
        # Get recent content of same type
        since = datetime.utcnow() - timedelta(days=lookback_days)
        
        candidates = await db.content_embedding.find_many({
            "where": {
                "contentType": content_type,
                "createdAt": {"gte": since}
            },
            "take": 1000  # Limit search space
        })
        
        matches = []
        
        for candidate in candidates:
            # Check exact hash match first
            if candidate.contentHash == content_hash:
                matches.append(SimilarityMatch(
                    content_id=candidate.contentId,
                    content_type=candidate.contentType,
                    user_id=candidate.userId,
                    similarity=1.0,
                    created_at=candidate.createdAt
                ))
                continue
            
            # Compute cosine similarity
            similarity = cosine_similarity(embedding, candidate.embedding)
            
            if similarity >= MODERATE_SIMILARITY_THRESHOLD:
                matches.append(SimilarityMatch(
                    content_id=candidate.contentId,
                    content_type=candidate.contentType,
                    user_id=candidate.userId,
                    similarity=similarity,
                    created_at=candidate.createdAt
                ))
        
        # Sort by similarity (descending)
        matches.sort(key=lambda m: m.similarity, reverse=True)
        
        return matches[:limit]
    
    except Exception as e:
        logger.error(f"Similarity search failed: {e}")
        return []


async def check_similarity(
    content_id: str,
    content_type: str,
    user_id: str,
    text: str,
    auto_store: bool = True
) -> SimilarityReport:
    """
    Check content for similarity/duplication.
    
    Main entry point for similarity detection.
    
    Args:
        content_id: ID of content to check
        content_type: "answer", "doubt", etc.
        user_id: User who created content
        text: The text content
        auto_store: Whether to store embedding automatically
    
    Returns:
        SimilarityReport with matches and recommendation
    """
    logger.info(f"Checking similarity for {content_type} {content_id}")
    
    # Compute hash and embedding
    content_hash = await compute_content_hash(text)
    embedding = await compute_embedding(text)
    
    # Find similar content
    matches = await find_similar_content(embedding, content_hash, content_type)
    
    # Analyze matches
    is_duplicate = False
    confidence = 0.0
    recommendation = "ALLOW"
    
    if matches:
        # Check for exact matches
        exact_matches = [m for m in matches if m.similarity >= EXACT_MATCH_THRESHOLD]
        high_matches = [m for m in matches if m.similarity >= HIGH_SIMILARITY_THRESHOLD]
        
        if exact_matches:
            is_duplicate = True
            confidence = max(m.similarity for m in exact_matches)
            
            # Check if from different user (plagiarism)
            different_user = any(m.user_id != user_id for m in exact_matches)
            
            if different_user:
                recommendation = "BLOCK"
                logger.warning(f"Exact match detected from different user")
            else:
                recommendation = "WARN"  # User reposting own content
                logger.info(f"User reposting own content")
        
        elif high_matches:
            is_duplicate = True
            confidence = max(m.similarity for m in high_matches)
            recommendation = "WARN"
            logger.info(f"High similarity detected: {confidence:.2f}")
        
        else:
            confidence = matches[0].similarity
            logger.info(f"Moderate similarity: {confidence:.2f}")
    
    # Store embedding if requested
    if auto_store and not is_duplicate:
        await store_content_embedding(
            content_id, content_type, user_id, text, embedding, content_hash
        )
    
    return SimilarityReport(
        is_duplicate=is_duplicate,
        confidence=confidence,
        matches=matches,
        recommendation=recommendation
    )


async def flag_duplicate_content(user_id: str, report: SimilarityReport) -> None:
    """
    Flag user for duplicate content abuse.
    
    Args:
        user_id: User ID
        report: Similarity detection report
    """
    try:
        db = get_db()
        
        await db.abuse_flag.create({
            "data": {
                "userId": user_id,
                "flagType": "DUPLICATE_CONTENT",
                "severity": "HIGH" if report.recommendation == "BLOCK" else "MEDIUM",
                "details": {
                    "confidence": report.confidence,
                    "matches_count": len(report.matches),
                    "recommendation": report.recommendation,
                    "similar_to": [
                        {
                            "content_id": m.content_id,
                            "user_id": m.user_id,
                            "similarity": m.similarity
                        }
                        for m in report.matches[:3]
                    ]
                },
                "autoModerated": report.recommendation == "BLOCK"
            }
        })
        
        logger.warning(f"Flagged user {user_id} for duplicate content")
    
    except Exception as e:
        logger.error(f"Failed to flag duplicate content: {e}")


logger.info("Similarity detector initialized")
