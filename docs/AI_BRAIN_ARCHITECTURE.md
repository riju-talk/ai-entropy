# AI Brain Architecture - NOVYRA Learning Engine

## Overview

The NOVYRA AI Brain is an **8-layer cognitive architecture** that transforms user queries into personalized, context-aware learning experiences. Unlike traditional chatbots, it models the user's knowledge state, identifies gaps, and delivers scaffolded reasoning that promotes independent learning.

---

## Design Philosophy

### Core Principles

1. **Cognitive Modeling** - Track user understanding dynamically
2. **Scaffolded Learning** - Provide hints before answers
3. **Context-Aware** - Leverage user history + community knowledge
4. **Fact-Checked** - Validate all generated claims
5. **Trust-Weighted** - Prioritize reliable sources and high-mastery users
6. **Explainable** - All reasoning steps are logged and auditable

### Anti-Patterns to Avoid

❌ **Direct answer-giving** - Bypasses learning  
❌ **Context-free responses** - Ignores user's knowledge state  
❌ **Unvalidated claims** - Spreads misinformation  
❌ **Black-box reasoning** - No explainability  

---

## Layer 1: Intent Detection

### Purpose
Classify user queries to determine the appropriate reasoning strategy.

### Input
```python
{
  "query": str,           # User's question
  "user_id": str,         # For context retrieval
  "metadata": dict        # Optional: course, subject tags
}
```

### Classification Types

| Intent Type | Description | Example Query | Routing |
|------------|-------------|---------------|---------|
| `DOUBT` | Conceptual question | "Why is recursion hard?" | Full reasoning pipeline |
| `EVALUATION` | Wants assessment | "Test my understanding of OOP" | Rubric evaluation |
| `REVISION` | Quick recall | "Remind me of Newton's laws" | Condensed retrieval |
| `EXPLORATION` | Open-ended | "Interesting physics topics?" | Recommendations |
| `DEFINITION` | Lookup query | "What is polymorphism?" | Direct retrieval |

### Implementation
```python
def detect_intent(query: str) -> Intent:
    # LLM-based classification with structured output
    prompt = f"""
    Classify this query into ONE category:
    - DOUBT: seeks explanation or understanding
    - EVALUATION: requests assessment or testing
    - REVISION: quick recall or summary
    - EXPLORATION: open-ended discovery
    - DEFINITION: fact lookup
    
    Query: {query}
    
    Return JSON: {{"intent": "...", "confidence": 0.0-1.0}}
    """
    
    response = llm.generate(prompt, temperature=0.1)
    return parse_intent(response)
```

### Output
```python
{
  "intent": Intent,
  "confidence": float,    # 0.0-1.0
  "reason": str           # Brief explanation
}
```

---

## Layer 2: Concept Mapping

### Purpose
Map the user's query to **specific concepts** in the knowledge graph for prerequisite traversal and mastery tracking.

### Input
```python
{
  "query": str,
  "intent": Intent,
  "domain": str | None    # Optional domain hint (CS, Math, Physics)
}
```

### Mapping Strategy

#### Primary: Embedding-Based Search
1. Embed query using Sentence-Transformers
2. Similarity search against concept embeddings (Neo4j vector index)
3. Return top-k concepts (k=5) with scores > 0.7

#### Secondary: LLM Extraction
If embedding search fails:
```python
prompt = f"""
Extract the core academic concept from this query.
Return the most specific concept name.

Examples:
- "Why use recursion?" → "Recursion"
- "Explain Newton's 2nd law" → "Newton's Second Law"
- "Help with binary search trees" → "Binary Search Tree"

Query: {query}
Concept:
"""
```

#### Tertiary: Fallback
Map to generic parent concept (e.g., "Programming Fundamentals")

### Knowledge Graph Structure

```cypher
// Neo4j node schema
(:Concept {
  id: string,
  name: string,
  description: string,
  domain: string,           // CS, Math, Physics, etc.
  difficulty: int,          // 1-10 scale
  embedding: vector[384]    // For similarity search
})

// Prerequisite relationships
(:Concept)-[:REQUIRES {weight: float}]->(:Concept)

// Similarity relationships (auto-generated)
(:Concept)-[:RELATED_TO {score: float}]->(:Concept)
```

### Output
```python
{
  "primary_concept": Concept | None,
  "related_concepts": List[Concept],  # Ranked by relevance
  "confidence": float,
  "method": "embedding" | "llm" | "fallback"
}
```

---

## Layer 3: Knowledge Graph Engine

### Purpose
Traverse the knowledge graph to identify **prerequisite chains** and ensure foundational concepts are addressed before advanced ones.

### Graph Operations

#### 1. Prerequisite Traversal
```cypher
// Find all prerequisites for a concept (recursive)
MATCH path = (c:Concept {id: $concept_id})-[:REQUIRES*]->(prereq:Concept)
RETURN prereq, length(path) as depth
ORDER BY depth DESC
```

#### 2. Weak Prerequisites Detection
Identify prerequisites the user hasn't mastered:
```python
def get_weak_prerequisites(user_id: str, concept_id: str) -> List[WeakPrereq]:
    prereqs = graph.get_prerequisites(concept_id)
    mastery_records = db.get_mastery_records(user_id, [p.id for p in prereqs])
    
    weak = []
    for prereq in prereqs:
        mastery = mastery_records.get(prereq.id)
        if mastery is None or mastery.score < 0.6:
            weak.append(WeakPrereq(
                concept=prereq,
                mastery_score=mastery.score if mastery else 0.0,
                priority=calculate_priority(prereq, concept_id)
            ))
    
    return sorted(weak, key=lambda x: x.priority, reverse=True)
```

#### 3. Cycle Prevention
Ensure no circular dependencies in the graph:
```cypher
// Detect cycles
MATCH cycle = (c:Concept)-[:REQUIRES*]->(c)
RETURN cycle
```

### Dependency Chain Structure
```
Advanced Concept (Target)
    │
    ├─ Prerequisite 1 (Weak - needs review)
    │   └─ Sub-prerequisite A (Strong)
    │
    ├─ Prerequisite 2 (Strong - OK)
    │
    └─ Prerequisite 3 (Weak - critical gap)
        ├─ Sub-prerequisite B (Weak)
        └─ Sub-prerequisite C (Strong)
```

### Output
```python
{
  "concept": Concept,
  "prerequisites": List[Concept],       # All prerequisites
  "weak_prerequisites": List[WeakPrereq],  # Needs review
  "dependency_depth": int,              # Max chain length
  "ready_for_learning": bool            # All prereqs mastered?
}
```

---

## Layer 4: User Cognitive State

### Purpose
Model the user's current understanding to personalize the learning experience.

### State Model

```python
@dataclass
class CognitiveState:
    user_id: str
    concept_id: str
    
    # Mastery metrics
    mastery_score: float          # 0.0-1.0 (primary metric)
    confidence_score: float       # 0.0-1.0 (self-reported or inferred)
    
    # Attempt history
    total_attempts: int
    correct_attempts: int
    recent_accuracy: float        # Last 5 attempts
    
    # Engagement metrics
    hints_used_avg: float         # Average hints per attempt
    time_spent_avg: int           # Seconds per attempt
    last_attempt_at: datetime
    
    # Learning trajectory
    improvement_trend: float      # Slope of recent scores
    decay_factor: float           # Time-based decay (0.0-1.0)
    streak_count: int             # Consecutive correct
    
    # Trust indicators
    answer_acceptance_rate: float # If user posts answers
    community_validation: float   # Upvotes / attempts
```

### Mastery Score Calculation

**Formula:**
```python
def calculate_mastery_score(attempts: List[Attempt]) -> float:
    if not attempts:
        return 0.0
    
    # Weighted recency (recent attempts matter more)
    weights = [math.exp(-0.1 * i) for i in range(len(attempts))]
    
    # Base score from accuracy
    accuracy = sum(w * a.is_correct for w, a in zip(weights, attempts)) / sum(weights)
    
    # Penalty for hint usage
    hint_penalty = sum(a.hints_used for a in attempts[-5:]) / (5 * 3)  # Max 3 hints
    
    # Confidence boost (faster = more confident)
    time_boost = 0.0
    if len(attempts) >= 3:
        avg_time = sum(a.time_taken for a in attempts[-3:]) / 3
        expected_time = 120  # 2 minutes baseline
        if avg_time < expected_time:
            time_boost = min(0.1, (expected_time - avg_time) / expected_time * 0.1)
    
    # Time decay (reduce score if not practiced recently)
    days_since = (datetime.now() - attempts[-1].created_at).days
    decay = math.exp(-0.05 * days_since)
    
    raw_score = accuracy - hint_penalty + time_boost
    final_score = raw_score * decay
    
    return max(0.0, min(1.0, final_score))
```

### Improvement Trend Analysis
```python
def calculate_improvement_trend(attempts: List[Attempt]) -> float:
    """
    Positive = improving, Negative = declining, Zero = stable
    """
    if len(attempts) < 3:
        return 0.0
    
    # Linear regression on recent attempts
    recent = attempts[-10:]  # Last 10 attempts
    x = list(range(len(recent)))
    y = [1.0 if a.is_correct else 0.0 for a in recent]
    
    slope = np.polyfit(x, y, 1)[0]  # Linear fit slope
    return slope  # Range: roughly -0.5 to +0.5
```

### Output
```python
{
  "cognitive_state": CognitiveState,
  "readiness_level": "beginner" | "intermediate" | "advanced",
  "recommended_difficulty": int,  # 1-10
  "engagement_quality": "low" | "medium" | "high"
}
```

---

## Layer 5: Context Assembly

### Purpose
Gather all relevant context to feed into the reasoning engine, respecting token limits.

### Context Sources (Priority Order)

1. **Weak Prerequisites** (Highest Priority)
   - Concepts user hasn't mastered but needs for current query
   - Limit: Top 3 weakest
   
2. **User Attempt History**
   - Last 5 attempts on related concepts
   - Include: questions asked, hints used, mistakes made
   
3. **Top Community Answers**
   - Accepted answers from high-trust users on similar queries
   - Filter by: trust_score > 0.7, upvotes > 5
   - Limit: Top 2
   
4. **Rubric History**
   - Previous evaluations on related concepts
   - Extract: common mistakes, areas of confusion
   
5. **Concept Definitions**
   - From knowledge graph
   - Include: primary concept + immediate prerequisites

### Token Budget Management

**Total Budget:** 4,000 tokens (for GPT-3.5/Gemini context window)

**Allocation:**
- System prompt: 200 tokens
- User query: ~100 tokens
- Weak prerequisites: 800 tokens (3 × ~250)
- User history: 500 tokens
- Community answers: 1000 tokens (2 × 500)
- Rubric history: 400 tokens
- Concept definitions: 600 tokens
- Reserved for output: 400 tokens

**Truncation Strategy:**
```python
def assemble_context(
    query: str,
    cognitive_state: CognitiveState,
    weak_prereqs: List[WeakPrereq],
    budget: int = 4000
) -> str:
    context_parts = []
    remaining = budget
    
    # 1. System prompt (fixed)
    system = get_system_prompt()
    context_parts.append(system)
    remaining -= count_tokens(system)
    
    # 2. User query
    context_parts.append(f"Query: {query}")
    remaining -= count_tokens(query) + 10
    
    # 3. Weak prerequisites (priority)
    prereq_text = format_weak_prerequisites(weak_prereqs[:3])
    if count_tokens(prereq_text) <= remaining * 0.3:
        context_parts.append(prereq_text)
        remaining -= count_tokens(prereq_text)
    
    # 4. User history (if space)
    if remaining > 500:
        history = get_user_history(cognitive_state.user_id, limit=5)
        history_text = format_history(history)
        if count_tokens(history_text) <= remaining * 0.2:
            context_parts.append(history_text)
            remaining -= count_tokens(history_text)
    
    # 5. Community answers
    if remaining > 800:
        answers = get_top_community_answers(query, cognitive_state.concept_id)
        answers_text = format_answers(answers[:2])
        if count_tokens(answers_text) <= remaining * 0.4:
            context_parts.append(answers_text)
            remaining -= count_tokens(answers_text)
    
    # 6. Concept definitions (if space)
    if remaining > 300:
        concepts = get_concept_definitions([cognitive_state.concept_id])
        context_parts.append(format_concepts(concepts))
    
    return "\n\n".join(context_parts)
```

### Output
```python
{
  "context": str,                   # Assembled prompt
  "token_count": int,               # Total tokens used
  "sources": List[ContextSource],   # What was included
  "truncated": bool                 # Hit token limit?
}
```

---

## Layer 6: Reasoning Engine

### Purpose
Generate **structured, step-by-step reasoning** that guides the user to understanding without directly giving answers.

### Reasoning Modes

#### Mode 1: Hint Ladder (Default for Doubts)
Progressive disclosure of hints, increasing in specificity.

```python
@dataclass
class HintLadder:
    level: int                    # 1-5
    hints: List[Hint]
    
@dataclass
class Hint:
    level: int
    text: str
    reveal_condition: str         # "on_request" | "on_failure"
```

**Example Ladder:**
```
Query: "Why doesn't my binary search work?"

Level 1 (Conceptual):
  "Binary search requires a sorted array. Is your input sorted?"

Level 2 (Diagnostic):
  "Check your mid calculation. Integer division can cause off-by-one errors."

Level 3 (Specific):
  "Try using mid = left + (right - left) // 2 to avoid overflow."

Level 4 (Near-Answer):
  "Your loop condition should be 'while left <= right', not 'left < right'."

Level 5 (Full Solution):
  "Here's a corrected implementation: [code]"
```

#### Mode 2: Socratic Questioning (For Evaluation)
Ask guiding questions to test understanding.

```python
questions = [
    "What is the Big-O complexity of binary search?",
    "Why does binary search require O(log n) time?",
    "What happens if the array is not sorted?"
]
```

#### Mode 3: Direct Explanation (For Definitions)
Concise, accurate response with sources.

### Structured Output Format

```json
{
  "reasoning_type": "hint_ladder" | "socratic" | "direct",
  "steps": [
    {
      "step_number": 1,
      "content": "First, identify the base case...",
      "reveal_level": 1,
      "confidence": 0.95
    }
  ],
  "final_answer": null | "Direct answer (only if requested)",
  "next_steps": ["Try implementing with these hints", "Request next hint"],
  "sources": ["Community Answer #123", "Concept: Recursion"]
}
```

### Prompt Engineering

**System Prompt Template:**
```
You are a Socratic tutor for {subject}. Your goal is to guide students to understanding, not give direct answers.

Student Level: {readiness_level}
Concept: {concept_name}
Mastery Score: {mastery_score}

Weak Prerequisites:
{weak_prerequisites}

Context:
{context}

Instructions:
1. Provide a hint ladder with 3 levels
2. Each hint should be progressively more specific
3. Do NOT give the final answer unless explicitly requested
4. Reference the student's previous attempts if relevant
5. Output JSON in the specified format

Student Query: {query}
```

### Output
```python
{
  "reasoning": StructuredReasoning,
  "prompt_used": str,               # For auditing
  "llm_metadata": {
    "model": str,
    "tokens_used": int,
    "latency_ms": int
  }
}
```

---

## Layer 7: Fact-Check & NLI Validation

### Purpose
Validate all AI-generated claims against retrieved context to prevent misinformation.

### NLI (Natural Language Inference)

**Model:** DistilRoBERTa fine-tuned on MNLI (Multi-Genre NLI)

**Labels:**
- `ENTAILMENT` - Claim is supported by context
- `CONTRADICTION` - Claim conflicts with context
- `NEUTRAL` - Cannot determine from context

### Validation Pipeline

```python
def fact_check_response(
    response: StructuredReasoning,
    context: str
) -> FactCheckResult:
    claims = extract_claims(response)
    
    results = []
    for claim in claims:
        # Run NLI model
        label, confidence = nli_model.predict(
            premise=context,
            hypothesis=claim.text
        )
        
        results.append(ClaimCheck(
            claim=claim.text,
            label=label,
            confidence=confidence,
            source_used=claim.source
        ))
    
    # Aggregate score
    avg_confidence = sum(r.confidence for r in results) / len(results)
    has_contradiction = any(r.label == "CONTRADICTION" for r in results)
    
    return FactCheckResult(
        checks=results,
        overall_confidence=avg_confidence,
        safe_to_display=not has_contradiction and avg_confidence > 0.7
    )
```

### Claim Extraction

```python
def extract_claims(reasoning: StructuredReasoning) -> List[Claim]:
    claims = []
    
    for step in reasoning.steps:
        # Extract factual statements (not questions)
        sentences = split_sentences(step.content)
        for sent in sentences:
            if is_factual_claim(sent):  # Heuristic: contains verb, not interrogative
                claims.append(Claim(
                    text=sent,
                    step_number=step.step_number,
                    source=step.get('source', 'generated')
                ))
    
    return claims
```

### Contradiction Handling

**If confidence < 0.7 OR contradiction detected:**
1. Flag the response for review
2. Emit `NLI_FLAG_RAISED` event
3. Return to user with warning OR regenerate with stricter constraints

```python
if not fact_check.safe_to_display:
    if fact_check.overall_confidence < 0.5:
        # Low confidence - regenerate
        return regenerate_with_fallback(query, context)
    else:
        # Contradiction - add warning
        return add_warning_banner(response, fact_check)
```

### Output
```python
{
  "fact_check": FactCheckResult,
  "claims_checked": int,
  "contradictions": int,
  "safe_to_display": bool
}
```

---

## Layer 8: Trust Scoring

### Purpose
Combine multiple signals to produce a **Trust Score** that influences XP rewards and community weight.

### Trust Components

#### 1. Mastery Reliability
How consistently accurate is the user on this topic?

```python
def mastery_reliability(user_id: str, concept_id: str) -> float:
    mastery = db.get_mastery_record(user_id, concept_id)
    if not mastery:
        return 0.5  # Neutral for new users
    
    # Penalize low mastery
    if mastery.score < 0.4:
        return 0.3
    elif mastery.score < 0.7:
        return 0.6
    else:
        return min(1.0, mastery.score + 0.2)  # Boost high mastery
```

#### 2. NLI Confidence
How often does this user's content pass fact-checking?

```python
def nli_track_record(user_id: str) -> float:
    recent_answers = db.get_user_answers(user_id, limit=20)
    fact_checks = [a.fact_check_score for a in recent_answers if a.fact_check_score]
    
    if not fact_checks:
        return 0.7  # Benefit of the doubt
    
    return sum(fact_checks) / len(fact_checks)
```

#### 3. Community Validation
How does the community rate this user's contributions?

```python
def community_validation(user_id: str) -> float:
    stats = db.get_user_stats(user_id)
    
    if stats.answers_posted == 0:
        return 0.5
    
    acceptance_rate = stats.accepted_answers / stats.answers_posted
    upvote_ratio = (stats.upvotes_received + 1) / (stats.votes_received + 2)  # Smoothing
    
    return (acceptance_rate * 0.6) + (upvote_ratio * 0.4)
```

#### 4. Account Age & Activity
Penalize brand-new accounts and inactive users.

```python
def account_trust(user_id: str) -> float:
    user = db.get_user(user_id)
    
    # Age factor (days since registration)
    days_active = (datetime.now() - user.created_at).days
    age_factor = min(1.0, days_active / 30)  # Full trust after 30 days
    
    # Activity factor (prevent inactive high-scores)
    days_since_active = (datetime.now() - user.last_active_at).days
    activity_factor = math.exp(-0.05 * days_since_active)
    
    return (age_factor * 0.4) + (activity_factor * 0.6)
```

### Final Trust Score Calculation

```python
def calculate_trust_score(user_id: str, concept_id: str) -> float:
    weights = {
        'mastery': 0.35,
        'nli': 0.25,
        'community': 0.25,
        'account': 0.15
    }
    
    components = {
        'mastery': mastery_reliability(user_id, concept_id),
        'nli': nli_track_record(user_id),
        'community': community_validation(user_id),
        'account': account_trust(user_id)
    }
    
    trust_score = sum(weights[k] * components[k] for k in weights)
    
    return trust_score  # 0.0-1.0
```

### Trust Score Impact

| Trust Range | XP Multiplier | Rate Limit | Can Earn Achievements? |
|------------|---------------|------------|------------------------|
| 0.0-0.3 (Low) | 0.5× | 50 req/hr | No |
| 0.3-0.5 (New) | 0.8× | 100 req/hr | Limited |
| 0.5-0.7 (Good) | 1.0× | 200 req/hr | Yes |
| 0.7-0.9 (High) | 1.2× | 500 req/hr | Yes |
| 0.9-1.0 (Expert) | 1.5× | 1000 req/hr | Yes + Rare |

### Output
```python
{
  "trust_score": float,
  "components": Dict[str, float],
  "multiplier": float,
  "rate_limit": int,
  "achievements_enabled": bool
}
```

---

## Complete Pipeline Execution

### Full Flow Example

```python
async def ai_brain_process(query: str, user_id: str) -> AIResponse:
    # Layer 1: Intent Detection
    intent = await detect_intent(query)
    
    # Layer 2: Concept Mapping
    concept_map = await map_concepts(query, intent)
    
    # Layer 3: Knowledge Graph Traversal
    graph_context = await traverse_graph(concept_map.primary_concept)
    
    # Layer 4: User Cognitive State
    cognitive_state = await get_cognitive_state(user_id, concept_map.primary_concept.id)
    
    # Layer 5: Context Assembly
    context = await assemble_context(
        query=query,
        cognitive_state=cognitive_state,
        weak_prereqs=graph_context.weak_prerequisites
    )
    
    # Layer 6: Reasoning Generation
    reasoning = await generate_reasoning(
        query=query,
        context=context,
        cognitive_state=cognitive_state,
        mode=get_reasoning_mode(intent)
    )
    
    # Layer 7: Fact-Check
    fact_check = await fact_check_response(reasoning, context.context)
    
    if not fact_check.safe_to_display:
        # Regenerate or flag
        reasoning = await regenerate_with_constraints(query, context, fact_check)
        fact_check = await fact_check_response(reasoning, context.context)
    
    # Layer 8: Trust Scoring
    trust = await calculate_trust_score(user_id, concept_map.primary_concept.id)
    
    # Emit event for XP processing
    await emit_event("AI_REASONING_COMPLETED", {
        "user_id": user_id,
        "concept_id": concept_map.primary_concept.id,
        "trust_score": trust.trust_score,
        "fact_check_passed": fact_check.safe_to_display
    })
    
    return AIResponse(
        intent=intent,
        concept=concept_map.primary_concept,
        reasoning=reasoning,
        fact_check=fact_check,
        trust_score=trust.trust_score,
        metadata={
            "cognitive_state": cognitive_state,
            "weak_prerequisites": graph_context.weak_prerequisites
        }
    )
```

---

## API Endpoints

### POST /api/ai/reason
```python
Request:
{
  "query": str,
  "user_id": str,
  "hint_level": int | null,  # Request specific hint level
  "context": dict | null     # Optional: previous attempt context
}

Response:
{
  "intent": str,
  "concept": {
    "id": str,
    "name": str,
    "mastery_score": float
  },
  "reasoning": {
    "type": str,
    "steps": [...],
    "current_hint_level": int,
    "max_hint_level": int
  },
  "trust_score": float,
  "fact_check_passed": bool,
  "next_actions": [
    "request_next_hint",
    "attempt_problem",
    "mark_complete"
  ]
}
```

---

## Performance Metrics

### Target Latencies
- Intent detection: <200ms
- Concept mapping: <500ms (with embedding cache)
- Graph traversal: <300ms
- Context assembly: <400ms
- LLM reasoning: <3000ms (model-dependent)
- Fact-check: <150ms per claim
- Trust calculation: <100ms

**Total End-to-End: <5 seconds**

### Optimization Strategies
- **Cache frequent concept embeddings** (Redis)
- **Batch NLI checks** (process all claims in one inference)
- **Precompute trust scores** (update on events, not on-demand)
- **Use streaming LLM responses** (progressive disclosure)

---

## Testing Requirements

### Unit Tests (Per Layer)
- Intent classification accuracy > 90%
- Concept mapping recall > 85%
- Graph traversal correctness (no cycles, correct ordering)
- Mastery score calculation validated against test cases
- Token budget never exceeded
- NLI model precision > 80% on test set

### Integration Tests
- Full pipeline execution < 5s
- Correct event emission on completion
- Fact-check blocks contradictory responses
- Trust score correctly influences outputs

### Edge Cases
- Query with no matching concept
- User with no attempt history
- Empty knowledge graph (fallback)
- Context exceeds token budget
- NLI model unavailable (fallback to display with warning)

---

## Audit Log

Every AI interaction must be logged:
```python
{
  "request_id": str,
  "user_id": str,
  "query": str,
  "intent": str,
  "concept_id": str,
  "reasoning_generated": str,
  "fact_check_result": dict,
  "trust_score": float,
  "timestamp": datetime,
  "latency_ms": int
}
```

**Retention:** 90 days  
**Purpose:** Debugging, abuse detection, model improvement

---

**Document Version:** 1.0  
**Last Updated:** 2026-02-27  
**Status:** ✅ Ready for Implementation
