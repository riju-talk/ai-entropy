"""
NOVYRA Integration Tests - AI Brain System

Tests for AI Brain Layers 1-7 and reasoning pipeline.
"""
import pytest
from datetime import datetime
from unittest.mock import Mock, AsyncMock, patch


# Test Layer 1 - Intent Detection
@pytest.mark.asyncio
async def test_intent_detection_concept_explanation():
    """Test intent detection for concept explanation."""
    from app.services.ai_brain.intent_detector import detect_intent
    
    question = "What is binary search?"
    
    with patch('app.services.ai_brain.intent_detector.generate_json') as mock_llm:
        mock_llm.return_value = {
            "intent": "CONCEPT_EXPLANATION",
            "confidence": 0.95,
            "reasoning": "Asking for definition of binary search"
        }
        
        intent = await detect_intent(question)
        
        assert intent.intent_type.value == "CONCEPT_EXPLANATION"
        assert intent.confidence == 0.95
        assert intent.response_strategy == "provide_definition"


@pytest.mark.asyncio
async def test_intent_detection_problem_solving():
    """Test intent detection for problem solving."""
    from app.services.ai_brain.intent_detector import detect_intent
    
    question = "How do I sort this array: [3, 1, 4, 1, 5]?"
    
    with patch('app.services.ai_brain.intent_detector.generate_json') as mock_llm:
        mock_llm.return_value = {
            "intent": "PROBLEM_SOLVING",
            "confidence": 0.92,
            "reasoning": "Asking for solution to specific problem"
        }
        
        intent = await detect_intent(question)
        
        assert intent.intent_type.value == "PROBLEM_SOLVING"
        assert intent.response_strategy == "step_by_step"


# Test Layer 2 - Concept Mapping
@pytest.mark.asyncio
async def test_concept_mapping_single_concept():
    """Test concept mapping with single concept."""
    from app.services.ai_brain.concept_mapper import extract_and_map_concepts
    
    question = "Explain quicksort algorithm"
    
    with patch('app.services.ai_brain.concept_mapper.generate_json') as mock_llm:
        mock_llm.return_value = {
            "concepts": ["quicksort"]
        }
    
    with patch('app.services.ai_brain.concept_mapper.get_neo4j_driver') as mock_neo:
        mock_session = AsyncMock()
        mock_result = Mock()
        mock_result.data.return_value = [
            {
                "node": {"name": "Quicksort", "id": "qs-123"},
                "score": 1.0
            }
        ]
        mock_session.run.return_value = mock_result
        mock_neo.return_value.session.return_value.__aenter__.return_value = mock_session
        
        concepts = await extract_and_map_concepts(question)
        
        assert len(concepts) == 1
        assert concepts[0].name == "Quicksort"
        assert concepts[0].confidence >= 0.9


@pytest.mark.asyncio
async def test_concept_mapping_multiple_concepts():
    """Test concept mapping with multiple concepts."""
    from app.services.ai_brain.concept_mapper import extract_and_map_concepts
    
    question = "Compare merge sort and quicksort"
    
    with patch('app.services.ai_brain.concept_mapper.generate_json') as mock_llm:
        mock_llm.return_value = {
            "concepts": ["merge sort", "quicksort"]
        }
    
    with patch('app.services.ai_brain.concept_mapper.get_neo4j_driver') as mock_neo:
        mock_session = AsyncMock()
        mock_result = Mock()
        mock_result.data.return_value = [
            {"node": {"name": "Merge Sort", "id": "ms-123"}, "score": 1.0},
            {"node": {"name": "Quicksort", "id": "qs-123"}, "score": 1.0}
        ]
        mock_session.run.return_value = mock_result
        mock_neo.return_value.session.return_value.__aenter__.return_value = mock_session
        
        concepts = await extract_and_map_concepts(question)
        
        assert len(concepts) == 2


# Test Layer 3 - Graph Traversal
@pytest.mark.asyncio
async def test_graph_traversal_prerequisites():
    """Test prerequisite traversal."""
    from app.services.ai_brain.graph_traversal import traverse_prerequisites
    
    concept_id = "qs-123"
    
    with patch('app.services.ai_brain.graph_traversal.get_neo4j_driver') as mock_neo:
        mock_session = AsyncMock()
        mock_result = Mock()
        mock_result.data.return_value = [
            {"prereq": {"id": "arr-123", "name": "Arrays"}, "depth": 1},
            {"prereq": {"id": "rec-123", "name": "Recursion"}, "depth": 1}
        ]
        mock_session.run.return_value = mock_result
        mock_neo.return_value.session.return_value.__aenter__.return_value = mock_session
        
        prereqs = await traverse_prerequisites(concept_id)
        
        assert len(prereqs) == 2
        assert any(p.name == "Arrays" for p in prereqs)
        assert any(p.name == "Recursion" for p in prereqs)


# Test Layer 4 - Cognitive State
@pytest.mark.asyncio
async def test_cognitive_state_mastery():
    """Test cognitive state computation."""
    from app.services.ai_brain.cognitive_state import compute_cognitive_state
    
    user_id = "user-123"
    concepts = [
        Mock(concept_id="qs-123", name="Quicksort")
    ]
    
    with patch('app.services.ai_brain.cognitive_state.get_db') as mock_db:
        mock_prisma = AsyncMock()
        mock_prisma.user_concept_mastery.find_many.return_value = [
            Mock(
                conceptId="qs-123",
                masteryScore=0.4,
                lastPracticed=datetime.utcnow(),
                practiceCount=3
            )
        ]
        mock_db.return_value = mock_prisma
        
        state = await compute_cognitive_state(user_id, concepts)
        
        assert state.overall_mastery == 0.4
        assert len(state.active_concepts) == 1
        assert state.active_concepts[0].name == "Quicksort"


@pytest.mark.asyncio
async def test_cognitive_state_struggling():
    """Test struggling concept detection."""
    from app.services.ai_brain.cognitive_state import compute_cognitive_state
    
    user_id = "user-123"
    concepts = [Mock(concept_id="qs-123", name="Quicksort")]
    
    with patch('app.services.ai_brain.cognitive_state.get_db') as mock_db:
        mock_prisma = AsyncMock()
        mock_prisma.user_concept_mastery.find_many.return_value = [
            Mock(
                conceptId="qs-123",
                masteryScore=0.2,
                lastPracticed=datetime.utcnow(),
                practiceCount=5
            )
        ]
        mock_db.return_value = mock_prisma
        
        state = await compute_cognitive_state(user_id, concepts)
        
        assert len(state.struggling_concepts) == 1
        assert state.struggling_concepts[0].name == "Quicksort"


# Test Layer 5 - Context Assembly
@pytest.mark.asyncio
async def test_context_assembly():
    """Test full context assembly."""
    from app.services.ai_brain.context_assembler import assemble_context
    from app.services.ai_brain.intent_detector import Intent, IntentType
    
    question = "How does quicksort work?"
    user_id = "user-123"
    
    # Mock all layers
    with patch('app.services.ai_brain.context_assembler.detect_intent') as mock_intent, \
         patch('app.services.ai_brain.context_assembler.extract_and_map_concepts') as mock_concepts, \
         patch('app.services.ai_brain.context_assembler.build_graph_context') as mock_graph, \
         patch('app.services.ai_brain.context_assembler.compute_cognitive_state') as mock_cognitive:
        
        mock_intent.return_value = Intent(
            intent_type=IntentType.CONCEPT_EXPLANATION,
            confidence=0.95,
            reasoning="Definition question",
            response_strategy="provide_definition"
        )
        
        mock_concepts.return_value = [
            Mock(name="Quicksort", concept_id="qs-123", confidence=0.95)
        ]
        
        mock_graph.return_value = Mock(
            prerequisites=[],
            related_concepts=[],
            dependent_concepts=[],
            learning_path=[]
        )
        
        mock_cognitive.return_value = Mock(
            overall_mastery=0.4,
            active_concepts=[Mock(name="Quicksort", mastery_score=0.4)],
            mastered_concepts=[],
            struggling_concepts=[]
        )
        
        context = await assemble_context(question, user_id)
        
        assert context.intent.intent_type == IntentType.CONCEPT_EXPLANATION
        assert len(context.concepts) == 1
        assert context.cognitive_state.overall_mastery == 0.4


# Test Layer 7 - NLI Validation
@pytest.mark.asyncio
async def test_nli_claim_extraction():
    """Test NLI claim extraction."""
    from app.services.ai_brain.nli_validator import extract_claims
    
    response = "Quicksort has O(n log n) average time complexity. It uses divide and conquer."
    
    with patch('app.services.ai_brain.nli_validator.generate_json') as mock_llm:
        mock_llm.return_value = {
            "claims": [
                {
                    "text": "Quicksort has O(n log n) average time complexity",
                    "claim_type": "factual",
                    "confidence": 0.95
                },
                {
                    "text": "It uses divide and conquer",
                    "claim_type": "conceptual",
                    "confidence": 0.9
                }
            ]
        }
        
        claims = await extract_claims(response)
        
        assert len(claims) == 2
        assert "O(n log n)" in claims[0].text


@pytest.mark.asyncio
async def test_nli_validation_pass():
    """Test NLI validation with passing claim."""
    from app.services.ai_brain.nli_validator import validate_response, NLIVerdict
    
    response = "Binary search has O(log n) time complexity."
    
    with patch('app.services.ai_brain.nli_validator.extract_claims') as mock_extract, \
         patch('app.services.ai_brain.nli_validator.validate_claim') as mock_validate:
        
        mock_extract.return_value = [
            Mock(text="Binary search has O(log n) time complexity", claim_type="factual", confidence=0.95)
        ]
        
        mock_validate.return_value = Mock(
            verdict=NLIVerdict.PASS,
            confidence=0.95,
            reasoning="Correct complexity",
            evidence=None
        )
        
        report = await validate_response(response)
        
        assert report.overall_verdict == NLIVerdict.PASS
        assert report.flags_count == 0


@pytest.mark.asyncio
async def test_nli_validation_flag():
    """Test NLI validation with flagged claim."""
    from app.services.ai_brain.nli_validator import validate_response, NLIVerdict
    
    response = "Binary search has O(1) time complexity."
    
    with patch('app.services.ai_brain.nli_validator.extract_claims') as mock_extract, \
         patch('app.services.ai_brain.nli_validator.validate_claim') as mock_validate:
        
        mock_extract.return_value = [
            Mock(text="Binary search has O(1) time complexity", claim_type="factual", confidence=0.95)
        ]
        
        mock_validate.return_value = Mock(
            verdict=NLIVerdict.FLAG,
            confidence=0.9,
            reasoning="Incorrect - should be O(log n)",
            evidence="Binary search complexity is O(log n)"
        )
        
        report = await validate_response(response)
        
        assert report.overall_verdict == NLIVerdict.FLAG
        assert report.flags_count == 1


# Test Anti-Abuse - Similarity Detection
@pytest.mark.asyncio
async def test_similarity_detection_no_match():
    """Test similarity detection with no matches."""
    from app.services.anti_abuse.similarity_detector import check_similarity
    
    content_id = "ans-123"
    content_type = "answer"
    user_id = "user-123"
    text = "Here is my unique answer about quicksort..."
    
    with patch('app.services.anti_abuse.similarity_detector.find_similar_content') as mock_find:
        mock_find.return_value = []
        
        report = await check_similarity(content_id, content_type, user_id, text, auto_store=False)
        
        assert not report.is_duplicate
        assert report.recommendation == "ALLOW"


@pytest.mark.asyncio
async def test_similarity_detection_exact_match():
    """Test similarity detection with exact match."""
    from app.services.anti_abuse.similarity_detector import check_similarity, SimilarityMatch
    from datetime import datetime
    
    content_id = "ans-123"
    content_type = "answer"
    user_id = "user-123"
    text = "Duplicate answer"
    
    with patch('app.services.anti_abuse.similarity_detector.find_similar_content') as mock_find:
        mock_find.return_value = [
            SimilarityMatch(
                content_id="ans-456",
                content_type="answer",
                user_id="user-999",  # Different user
                similarity=0.99,
                created_at=datetime.utcnow()
            )
        ]
        
        report = await check_similarity(content_id, content_type, user_id, text, auto_store=False)
        
        assert report.is_duplicate
        assert report.recommendation == "BLOCK"


# Test Anti-Abuse - Vote Manipulation
@pytest.mark.asyncio
async def test_vote_manipulation_detection():
    """Test vote manipulation detection."""
    from app.services.anti_abuse.vote_analyzer import detect_mutual_voting
    
    user_id = "user-123"
    
    with patch('app.services.anti_abuse.vote_analyzer.get_db') as mock_db:
        mock_prisma = AsyncMock()
        
        # User voted for A, B, C
        mock_prisma.vote_graph.find_many.side_effect = [
            [
                Mock(voterId=user_id, targetUserId="user-A"),
                Mock(voterId=user_id, targetUserId="user-B"),
                Mock(voterId=user_id, targetUserId="user-C")
            ],
            # A, B, C all voted back
            [
                Mock(voterId="user-A", targetUserId=user_id),
                Mock(voterId="user-B", targetUserId=user_id),
                Mock(voterId="user-C", targetUserId=user_id)
            ]
        ]
        
        mock_db.return_value = mock_prisma
        
        pattern = await detect_mutual_voting(user_id)
        
        assert pattern is not None
        assert pattern.pattern_type == "MUTUAL_VOTING"
        assert pattern.confidence == 1.0  # 3/3 mutual


# Test Security - Input Validation
def test_validate_doubt_success():
    """Test doubt validation success."""
    from app.utils.validation import validate_doubt
    
    title = "How does quicksort work?"
    content = "I need help understanding the quicksort algorithm and its implementation."
    tags = ["algorithms", "sorting", "quicksort"]
    
    clean_title, clean_content, clean_tags = validate_doubt(title, content, tags)
    
    assert clean_title == title
    assert clean_content == content
    assert clean_tags == tags


def test_validate_doubt_sql_injection():
    """Test doubt validation blocks SQL injection."""
    from app.utils.validation import validate_doubt, ValidationError
    
    title = "Question about algorithms"
    content = "How does this work? '; DROP TABLE users; --"
    tags = ["algorithms"]
    
    with pytest.raises(ValidationError) as exc:
        validate_doubt(title, content, tags)
    
    assert "malicious" in str(exc.value).lower()


def test_validate_doubt_xss():
    """Test doubt validation blocks XSS."""
    from app.utils.validation import validate_doubt, ValidationError
    
    title = "Question about algorithms"
    content = "How does this work? <script>alert('xss')</script>"
    tags = ["algorithms"]
    
    with pytest.raises(ValidationError) as exc:
        validate_doubt(title, content, tags)
    
    assert "malicious" in str(exc.value).lower()


def test_validate_search_query():
    """Test search query validation."""
    from app.utils.validation import validate_search_query
    
    query = "  quicksort algorithm  "
    clean = validate_search_query(query)
    
    assert clean == "quicksort algorithm"


# Test Rate Limiting
def test_rate_limiter_allows_requests():
    """Test rate limiter allows requests within limit."""
    from app.middleware.rate_limit import RateLimiter
    
    limiter = RateLimiter()
    key = "test-user"
    
    # Should allow first 5 requests
    for i in range(5):
        allowed, _ = limiter.is_allowed(key, max_requests=5, window=60)
        assert allowed


def test_rate_limiter_blocks_excess():
    """Test rate limiter blocks excess requests."""
    from app.middleware.rate_limit import RateLimiter
    
    limiter = RateLimiter()
    key = "test-user"
    
    # Use up limit
    for i in range(5):
        limiter.is_allowed(key, max_requests=5, window=60)
    
    # Next request should be blocked
    allowed, retry_after = limiter.is_allowed(key, max_requests=5, window=60)
    assert not allowed
    assert retry_after > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
