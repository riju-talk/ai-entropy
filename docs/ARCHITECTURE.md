> **Note:** parts of this document describe the earlier AWS design (Bedrock, SQS/Lambda, S3). The current stack is Groq + local embeddings, in-process message queues and Supabase Storage; see the [README](../README.md) and [DEPLOYMENT.md](../DEPLOYMENT.md).

# 🏗 NOVYRA System Architecture

> Knowledge-Graph-Driven Adaptive Learning Infrastructure

---

## 🎯 System Vision

**NOVYRA is not a chatbot. It's learning infrastructure.**

Traditional AI tutors:
- ❌ Retrieve information from vector stores
- ❌ Generate generic explanations
- ❌ No understanding of learning progression
- ❌ Black box decision making

NOVYRA:
- ✅ Structured knowledge graph with prerequisite relationships
- ✅ Adaptive reasoning based on learner's mastery state
- ✅ Explainable evaluation with confidence calibration
- ✅ Hybrid edge/cloud inference for scalability

---

## 📐 7-Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERFACE LAYER                     │
│  Question Interface │ Study Planner │ Community Forum      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              INTERACTION & INTENT ENGINE                    │
│  Intent Detection │ Concept Extraction │ Task Classification│
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│         ADAPTIVE LEARNING INTELLIGENCE CORE                 │
│  Hint Ladder │ Socratic Reasoning │ Misconception Detection│
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              KNOWLEDGE GRAPH BRAIN (Neo4j)                  │
│  Concepts │ Prerequisites │ Mastery States │ Dependencies   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│           COMMUNITY INTELLIGENCE LAYER                      │
│  Concept Mapping │ Quality Filtering │ Reputation Weighting│
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│          EVALUATION & MASTERY ENGINE                        │
│  Rubric Grading │ Confidence Calibration │ Mastery Tracking │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│    HYBRID AI RUNTIME (Cloud + AMD Edge)                     │
│  Graph-Aware RAG │ Vector Search │ NPU Inference Routing   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧠 Knowledge Graph Structure

### Node Types

```cypher
(:Concept {
  name: String,
  description: String,
  domain: String,
  difficulty: Integer
})

(:User {
  id: String,
  mastery_profile: Map
})
```

### Relationship Types

```cypher
// Prerequisite dependency
(Arrays)-[:PREREQUISITE_OF]->(Binary Search)

// Mastery tracking
(User)-[:MASTERED_BY {score: 0.8, updated: timestamp}]->(Concept)

// Failure tracking for intervention
(User)-[:STRUGGLES_WITH {attempts: 3}]->(Concept)

// Conceptual similarity
(BFS)-[:RELATED_TO {weight: 0.7}]->(DFS)

// Topic hierarchy
(Binary Search)-[:PART_OF]->(Searching Algorithms)
```

### Example Graph Query

```cypher
// Find learning path for weak concept
MATCH (user:User {id: $userId})-[r:MASTERED_BY]->(weak:Concept)
WHERE r.score < 0.5
MATCH path = (prereq:Concept)-[:PREREQUISITE_OF*]->(weak)
WHERE NOT EXISTS {
  (user)-[m:MASTERED_BY]->(prereq)
  WHERE m.score >= 0.7
}
RETURN prereq.name AS recommended_concept
ORDER BY prereq.difficulty ASC
LIMIT 5
```

---

## 🔄 Complete Learning Flow

### User asks: "How does binary search work?"

```
1. INTENT DETECTION
   ↓ "explain" + "binary search"
   → Task: conceptual explanation

2. CONCEPT IDENTIFICATION
   ↓ Extract: "Binary Search"
   → Domain: Computer Science

3. KNOWLEDGE GRAPH QUERY
   ↓ Cypher: MATCH (c:Concept {name: "Binary Search"})
             MATCH (prereq)-[:PREREQUISITE_OF]->(c)
   → Prerequisites: [Arrays, Linear Search]

4. USER MASTERY LOOKUP
   ↓ Check: User mastery of prerequisites
   → Arrays: 0.4 (weak)
   → Linear Search: 0.6 (okay)

5. CONTEXT ASSEMBLY
   ↓ Build enriched context:
   - Concept description
   - Prerequisites and their mastery
   - Related concepts
   - Common misconceptions
   - Community Q&A

6. STRUCTURED REASONING
   ↓ Gemini generates response with:
   - Prerequisite review (Arrays)
   - Step-by-step explanation
   - Hint ladder (hidden)
   - Misconception warnings
   - Practice problems

7. MASTERY UPDATE
   ↓ Record interaction:
   - Attempt logged
   - Confidence weight adjusted
   - Neo4j edge updated
   - Recommendation trigger if needed
```

---

## 🎯 Adaptive Engine Logic

### Mastery Score Calculation

```python
mastery_score = (correct_attempts / total_attempts) * confidence_weight

confidence_weight = 1.0
  - hint_penalty (0.1 per hint used)
  - time_decay (days since last attempt > 7)
  - reattempt_penalty (frequency of failures)
```

### Recommendation Algorithm

```python
def get_learning_path(user_id, target_concept):
    # Get user's weak prerequisites
    weak_nodes = graph.query("""
        MATCH (u:User {id: $userId})-[r:MASTERED_BY]->(c:Concept)
        WHERE r.score < 0.5
        RETURN c
    """)
    
    # Find shortest path through weak nodes to target
    path = graph.shortest_path(
        start=weak_nodes[0],
        end=target_concept,
        relationship="PREREQUISITE_OF"
    )
    
    # Order by difficulty (easiest first)
    return sorted(path, key=lambda c: c.difficulty)
```

### Hint Ladder Generation

```python
def generate_hints(problem, difficulty):
    hints = []
    
    # Level 1: Concept reminder
    hints.append(f"Remember: {get_prerequisite_summary(problem)}")
    
    # Level 2: Approach hint
    hints.append(f"Think about: {get_approach_hint(problem)}")
    
    # Level 3: Partial solution
    hints.append(f"Try this step: {get_first_step(problem)}")
    
    # Level 4: Nearly complete
    hints.append(f"You're close! Now: {get_final_hint(problem)}")
    
    return hints[:difficulty]  # More hints for harder problems
```

---

## 🔬 Rubric-Aware Evaluation

### Rubric Structure

```json
{
  "rubric_name": "Binary Search Implementation",
  "criteria": [
    {
      "name": "Correctness",
      "weight": 0.4,
      "levels": [
        {"score": 4, "description": "Fully correct with edge cases"},
        {"score": 3, "description": "Correct for main cases"},
        {"score": 2, "description": "Logical errors present"},
        {"score": 1, "description": "Major misunderstanding"}
      ]
    },
    {
      "name": "Code Quality",
      "weight": 0.3,
      "levels": [...]
    },
    {
      "name": "Explanation",
      "weight": 0.3,
      "levels": [...]
    }
  ]
}
```

### Evaluation Process

```
1. Parse rubric into structured criteria
2. Extract dimensions (correctness, quality, explanation)
3. For each dimension:
   - LLM evaluates with JSON schema
   - Assigns level (1-4)
   - Provides evidence
4. Compute weighted total
5. Generate actionable feedback
6. Calibrate confidence (if model unsure, flag for human review)
```

---

## ⚡ AMD Edge Inference Architecture

### Decision Tree

```
Query arrives
    ↓
Is it simple (< 500 chars) AND realtime required?
    YES → Route to AMD NPU (Edge)
    NO  ↓
Is it complex reasoning or needs latest knowledge?
    YES → Route to Cloud (Gemini)
    NO  ↓
Route to Edge CPU (fallback)
```

### Edge Model Stack

```
1. Quantized ONNX Model (Phi-2 INT4)
   ├─ Model Size: 1.2 GB
   ├─ Latency: 50-100ms
   └─ Use Case: Simple Q&A, definitions

2. AMD NPU Optimization (DirectML)
   ├─ Hardware: Ryzen AI NPU
   ├─ Performance: 40+ TOPS
   └─ Power: 70% less than GPU

3. Cloud Fallback (Gemini 1.5 Flash)
   ├─ Latency: 800-1500ms
   ├─ Capability: Complex reasoning
   └─ Cost: $0.0001/request
```

### Performance Metrics

| Metric | Cloud | Edge CPU | Edge NPU |
|--------|-------|----------|----------|
| Latency | 1200ms | 300ms | 80ms |
| Cost/1K requests | $0.10 | $0 | $0 |
| Quality | ★★★★★ | ★★★☆☆ | ★★★★☆ |
| Power | N/A | 25W | 5W |

---

## 📊 Data Flow & State Management

### State Stores

```
1. Neo4j (Knowledge Graph)
   - Concepts and their relationships
   - User mastery edges
   - Learning paths

2. PostgreSQL (Relational)
   - User profiles
   - Attempt history (audit log)
   - Rubric evaluations
   - Community posts/answers

3. In-Memory Cache (Redis)
   - Active session state
   - Frequent queries
   - Rate limiting

4. Vector Store (Pinecone) [Optional]
   - Semantic search for community content
   - Related concept discovery
```

### Consistency Model

```
Write Flow:
1. Transaction begins in PostgreSQL
2. Attempt logged (immutable record)
3. Async job updates Neo4j mastery edge
4. Cache invalidated
5. Frontend receives updated state

Read Flow:
1. Check Redis cache
2. If miss, query Neo4j for graph context
3. Join with PostgreSQL for detailed records
4. Cache result
5. Return to client
```

---

## 🔐 Security & Privacy

### Data Protection

- ✅ User PII encrypted at rest (AES-256)
- ✅ API authentication via JWT tokens
- ✅ Rate limiting per user (100 req/min)
- ✅ Content moderation on submissions
- ✅ Audit logs for all evaluations

### AI Safety

- ✅ Gemini safety filters enabled
- ✅ Output validation against schema
- ✅ Confidence thresholds for auto-feedback
- ✅ Human-in-the-loop for low-confidence evaluations
- ✅ Version control on prompts

---

## 📈 Scalability Strategy

### Horizontal Scaling

```
Load Balancer
    ├─ API Server 1 (Stateless)
    ├─ API Server 2 (Stateless)
    └─ API Server N (Stateless)
         ↓
    Neo4j Cluster (Read Replicas)
         ↓
    PostgreSQL Primary + Replicas
```

### Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| Graph Query | < 50ms | ~30ms |
| LLM Inference | < 2s | ~1.2s |
| End-to-End | < 3s | ~2.5s |
| Concurrent Users | 10K+ | Tested to 500 |

### Cost Optimization

- **Edge execution**: 60% of queries → $0 cloud cost
- **Caching**: 40% cache hit rate → 40% fewer LLM calls
- **Batch processing**: Nightly graph updates → lower DB load
- **Auto-scaling**: Scale down during off-hours → 30% compute savings

---

## 🎯 Key Differentiators

### vs Traditional RAG Systems

| Feature | RAG | NOVYRA |
|---------|-----|--------|
| Context | Vector similarity | Prerequisite graph |
| Adaptation | Static | Mastery-aware |
| Evaluation | Heuristic | Rubric-based |
| Explainability | Low | High |
| Learning Path | None | Dynamic |

### vs Learning Management Systems (LMS)

| Feature | LMS | NOVYRA |
|---------|-----|--------|
| Content | Static courses | Dynamic concept graph |
| Personalization | Rule-based | AI-driven |
| Feedback | Delayed | Real-time |
| Intervention | Manual | Automatic |
| Scalability | Instructor-limited | Automated |

---

## 🚀 Future Enhancements

### Phase 2 (Post-Hackathon)

1. **Real-time Collaboration**
   - Peer learning sessions
   - Shared concept exploration

2. **Teacher Dashboard**
   - Class-level analytics
   - Intervention recommendations
   - Custom rubric builder

3. **Mobile App**
   - Offline learning with edge models
   - Push notifications for milestones

### Phase 3 (Production)

1. **Multi-modal Learning**
   - Image/video analysis
   - Voice interaction
   - Interactive simulations

2. **Advanced Analytics**
   - Predictive failure detection
   - Learning style identification
   - Curriculum optimization

3. **Enterprise Features**
   - SSO integration
   - LTI compliance for LMS integration
   - White-label deployment

---

## 📚 Technical Stack Summary

**Backend:**
- Python 3.11, FastAPI
- Neo4j (Knowledge Graph)
- PostgreSQL (Relational Data)
- Redis (Caching)

**AI/ML:**
- Google Gemini 1.5 (LLM)
- AMD NPU (Edge Inference)
- ONNX Runtime (Model Serving)
- DirectML (AMD Optimization)

**Frontend:**
- Next.js 14, React
- TailwindCSS
- Prisma ORM

**Infrastructure:**
- Docker, Docker Compose
- Vercel (Frontend)
- Render (Backend)
- Neo4j Aura (Graph DB)

---

**This architecture positions NOVYRA as research-grade learning infrastructure, not just another AI tutor.**
