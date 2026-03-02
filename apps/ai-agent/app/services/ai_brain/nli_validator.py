"""
NOVYRA AI Brain - Layer 7: NLI Validator

Fact-checking layer using Natural Language Inference.
Reference: docs/NLI_ARCHITECTURE.md
"""
import logging
import re
from typing import List, Optional, Dict, Any
from enum import Enum
from dataclasses import dataclass

from app.core.llm import generate_json
from app.core.database import get_db

logger = logging.getLogger(__name__)


class NLIVerdict(str, Enum):
    """NLI validation verdicts."""
    PASS = "PASS"  # Claim is supported
    UNCERTAIN = "UNCERTAIN"  # Cannot verify
    FLAG = "FLAG"  # Likely incorrect


@dataclass
class Claim:
    """Extracted claim from text."""
    text: str
    claim_type: str  # "factual", "procedural", "conceptual"
    confidence: float


@dataclass
class ValidationResult:
    """Result of NLI validation."""
    verdict: NLIVerdict
    confidence: float
    reasoning: str
    evidence: Optional[str] = None


@dataclass
class NLIReport:
    """Complete NLI validation report."""
    claims: List[Claim]
    results: List[ValidationResult]
    overall_verdict: NLIVerdict
    overall_confidence: float
    flags_count: int


# Claim extraction prompt
CLAIM_EXTRACTION_PROMPT = """Extract verifiable claims from this educational response.

Response: {response_text}

Identify factual statements that can be verified (not opinions or examples).

Return JSON:
{{
  "claims": [
    {{
      "text": "The exact claim statement",
      "claim_type": "factual|procedural|conceptual",
      "confidence": 0.0-1.0
    }}
  ]
}}

Focus on statements about:
- Technical definitions
- Algorithmic properties
- Computational complexity
- Mathematical facts
- Historical information

Exclude:
- Examples
- Analogies
- Pedagogical explanations
"""


# NLI validation prompt (simulated - in production would use ONNX model)
NLI_VALIDATION_PROMPT = """Validate this claim about computer science/mathematics.

Claim: {claim_text}

Context: {context}

Is this claim accurate? Consider:
1. Technical correctness
2. Common misconceptions
3. Edge cases
4. Accepted definitions

Return JSON:
{{
  "verdict": "PASS|UNCERTAIN|FLAG",
  "confidence": 0.0-1.0,
  "reasoning": "explanation of verdict",
  "evidence": "supporting information or correction"
}}

Use:
- PASS: Claim is correct and well-supported
- UNCERTAIN: Cannot definitively verify (needs more context)
- FLAG: Claim is likely incorrect or misleading
"""


async def extract_claims(response_text: str) -> List[Claim]:
    """
    Extract verifiable claims from a response.
    
    Uses LLM to identify factual statements that can be validated.
    
    Args:
        response_text: The response to analyze
    
    Returns:
        List of extracted claims
    """
    try:
        prompt = CLAIM_EXTRACTION_PROMPT.format(response_text=response_text)
        
        result = await generate_json(
            prompt,
            system_prompt="You are an expert at identifying verifiable claims in educational content."
        )
        
        claims = []
        for claim_data in result.get("claims", []):
            claim = Claim(
                text=claim_data["text"],
                claim_type=claim_data["claim_type"],
                confidence=float(claim_data["confidence"])
            )
            claims.append(claim)
        
        logger.info(f"Extracted {len(claims)} claims from response")
        return claims
    
    except Exception as e:
        logger.error(f"Claim extraction failed: {e}")
        return []


async def validate_claim(claim: Claim, context: str = "") -> ValidationResult:
    """
    Validate a single claim using NLI.
    
    In production, this would use an ONNX DistilRoBERTa model.
    For now, uses LLM-based validation.
    
    Args:
        claim: The claim to validate
        context: Additional context (concept, prerequisites, etc.)
    
    Returns:
        ValidationResult with verdict and reasoning
    """
    try:
        prompt = NLI_VALIDATION_PROMPT.format(
            claim_text=claim.text,
            context=context or "General CS/Math knowledge"
        )
        
        result = await generate_json(
            prompt,
            system_prompt="You are an expert fact-checker for computer science and mathematics education."
        )
        
        verdict = NLIVerdict(result["verdict"])
        confidence = float(result["confidence"])
        reasoning = result["reasoning"]
        evidence = result.get("evidence")
        
        logger.info(f"Validated claim: {verdict.value} (confidence: {confidence:.2f})")
        
        return ValidationResult(
            verdict=verdict,
            confidence=confidence,
            reasoning=reasoning,
            evidence=evidence
        )
    
    except Exception as e:
        logger.error(f"Claim validation failed: {e}")
        return ValidationResult(
            verdict=NLIVerdict.UNCERTAIN,
            confidence=0.5,
            reasoning=f"Validation error: {str(e)}"
        )


async def validate_response(
    response_text: str,
    context: str = "",
    min_confidence: float = 0.7
) -> NLIReport:
    """
    Validate entire response using NLI.
    
    Extracts claims and validates each one.
    
    Args:
        response_text: The response to validate
        context: Additional context for validation
        min_confidence: Minimum confidence threshold for PASS
    
    Returns:
        NLIReport with all validation results
    """
    # Extract claims
    claims = await extract_claims(response_text)
    
    if not claims:
        # No verifiable claims - pass by default (might be explanation/example)
        return NLIReport(
            claims=[],
            results=[],
            overall_verdict=NLIVerdict.PASS,
            overall_confidence=1.0,
            flags_count=0
        )
    
    # Validate each claim
    results = []
    for claim in claims:
        validation = await validate_claim(claim, context)
        results.append(validation)
    
    # Compute overall verdict
    flags_count = sum(1 for r in results if r.verdict == NLIVerdict.FLAG)
    uncertain_count = sum(1 for r in results if r.verdict == NLIVerdict.UNCERTAIN)
    
    # Overall verdict logic
    if flags_count > 0:
        overall_verdict = NLIVerdict.FLAG
    elif uncertain_count > len(claims) / 2:
        overall_verdict = NLIVerdict.UNCERTAIN
    else:
        overall_verdict = NLIVerdict.PASS
    
    # Overall confidence (average of PASS/UNCERTAIN, penalize FLAGS)
    confidences = [r.confidence for r in results if r.verdict != NLIVerdict.FLAG]
    overall_confidence = sum(confidences) / len(confidences) if confidences else 0.5
    
    # Penalty for flags
    if flags_count > 0:
        overall_confidence *= (1.0 - (flags_count / len(claims)) * 0.5)
    
    return NLIReport(
        claims=claims,
        results=results,
        overall_verdict=overall_verdict,
        overall_confidence=overall_confidence,
        flags_count=flags_count
    )


async def log_fact_check(
    user_id: str,
    content_type: str,
    content_id: str,
    report: NLIReport
) -> None:
    """
    Log fact-check results to database.
    
    Args:
        user_id: User who created the content
        content_type: "answer", "doubt", etc.
        content_id: ID of the content
        report: NLI validation report
    """
    try:
        db = get_db()
        
        await db.fact_check_log.create({
            "data": {
                "userId": user_id,
                "contentType": content_type,
                "contentId": content_id,
                "verdict": report.overall_verdict.value,
                "confidence": report.overall_confidence,
                "claimsChecked": len(report.claims),
                "flagsRaised": report.flags_count,
                "details": {
                    "claims": [
                        {
                            "text": c.text,
                            "type": c.claim_type,
                            "verdict": r.verdict.value,
                            "confidence": r.confidence,
                            "reasoning": r.reasoning
                        }
                        for c, r in zip(report.claims, report.results)
                    ]
                }
            }
        })
        
        logger.info(f"Logged fact-check for {content_type} {content_id}: {report.overall_verdict.value}")
    
    except Exception as e:
        logger.error(f"Failed to log fact-check: {e}")


async def emit_nli_event(user_id: str, report: NLIReport) -> None:
    """
    Emit NLI events for trust score updates.
    
    Args:
        user_id: User ID
        report: NLI validation report
    """
    try:
        from app.services.events.event_bus import emit_event
        from app.services.events.event_definitions import Event, EventType
        
        # Emit NLI_CHECKED event
        await emit_event(Event(
            event_type=EventType.NLI_CHECKED,
            user_id=user_id,
            metadata={
                "verdict": report.overall_verdict.value,
                "confidence": report.overall_confidence,
                "claims_count": len(report.claims),
                "flags_count": report.flags_count
            }
        ))
        
        # If flagged, emit NLI_FLAG_RAISED
        if report.overall_verdict == NLIVerdict.FLAG:
            await emit_event(Event(
                event_type=EventType.NLI_FLAG_RAISED,
                user_id=user_id,
                metadata={
                    "flags_count": report.flags_count,
                    "flagged_claims": [
                        {
                            "claim": c.text,
                            "reasoning": r.reasoning
                        }
                        for c, r in zip(report.claims, report.results)
                        if r.verdict == NLIVerdict.FLAG
                    ]
                }
            ))
            
            logger.warning(f"NLI flags raised for user {user_id}: {report.flags_count} flags")
    
    except Exception as e:
        logger.error(f"Failed to emit NLI event: {e}")


logger.info("NLI validator initialized (Layer 7)")
