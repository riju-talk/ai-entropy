# 🧠 NOVYRA 7-Layer AI Brain Testing Guide

## Overview

This guide walks you through testing NOVYRA's **7-layer adaptive learning intelligence** end-to-end. This is the "main sauce" that makes judges' legs shake.

## Architecture Recap

```
┌─────────────────────────────────────────────────────────────────┐
│                    NOVYRA 7-Layer AI Brain                      │
├─────────────────────────────────────────────────────────────────┤
│  Layer 1: Intent Detection (Gemini 1.5 Flash)                   │
│  Layer 2: Concept Extraction (Knowledge Graph Query)            │
│  Layer 3: Prerequisite Analysis (Neo4j Shortest Path)           │
│  Layer 4: Context Assembly (Graph + User Mastery)               │
│  Layer 5: Adaptive Reasoning (Structured JSON Output)           │
│  Layer 6: Mastery Update (Confidence-Weighted Tracking)         │
│  Layer 7: Personalized Nudge Generation (Struggling Detection)  │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

### 1. Start Backend (FastAPI)

```bash
cd apps/ai-agent
python -m app.main
```

Expected output:
```
INFO: ====================================================================
INFO: NOVYRA AI Engine starting on port 8000
INFO:     LLM   : gemini-1.5-flash-latest
INFO:     Neo4j : neo4j://localhost:7687
INFO: ====================================================================
INFO: Neo4j connection OK
```

### 2. Seed Knowledge Graph (First Time Only)

```bash
curl -X POST http://localhost:8000/api/demo/seed-knowledge-graph
```

This populates 200+ concepts across 25+ disciplines with prerequisite relationships.

Expected output:
```json
{
  "status": "success",
  "concepts_added": 200+,
  "relationships_created": 300+,
  "message": "Knowledge graph seeded with universal concepts"
}
```

### 3. Start Frontend (Next.js)

```bash
cd apps/app
npm run dev
```

## End-to-End Testing Scenarios

### ✅ Scenario 1: New User - First Question

**Goal**: Test complete flow from question → reasoning → mastery tracking

**Steps**:
1. Navigate to http://localhost:3000/learn
2. Sign in (or use as anonymous)
3. Ask: `"What is binary search?"`

**Expected Behavior**:
- ✅ Layer 1: System detects this is a CS algorithm question
- ✅ Layer 2: Extracts concept: "Binary Search"
- ✅ Layer 3: Identifies prerequisites: ["Array", "Sorting", "Recursion or Iteration"]
- ✅ Layer 4: Queries Neo4j for graph context (neighbors, depth-1)
- ✅ Layer 5: Generates structured reasoning with:
  - Stepwise breakdown (3-5 steps)
  - Hint ladder (3 progressive hints)
  - Final solution with example
  - Confidence score (0.85-0.95)
  - Related concepts (["Linear Search", "Divide and Conquer", "Time Complexity"])
- ✅ Layer 6: Records first attempt → mastery = 0.8 (assuming understood)
- ✅ Layer 7: No nudge (mastery above threshold)

**UI Verification**:
- Prerequisites shown with status indicators
- Hint ladder with "Reveal Hint 1/2/3" buttons
- Mastery badge shows "80%" for Binary Search
- Related concepts displayed as tags

---

### ✅ Scenario 2: Struggling Student - Hint Usage

**Goal**: Test hint penalty and mastery decay

**Steps**:
1. Ask: `"How do I implement merge sort?"`
2. Reveal Hint 1 → Reveal Hint 2 → Reveal Hint 3

**Expected Behavior**:
- ✅ Confidence weight decreases with each hint: 0.8 → 0.65 → 0.5
- ✅ Mastery score adjusted: `mastery = (correct/total) * confidence_weight`
- ✅ If mastery drops below 0.4, nudge generated: _"You're struggling with Merge Sort. Review Recursion and Divide and Conquer first."_
- ✅ Weak node detected in graph
- ✅ Recommended path shown: [Recursion] → [Divide and Conquer] → [Merge Sort]

**UI Verification**:
- Mastery update card appears (red/yellow theme)
- Status badge shows "struggling"
- Nudge message displayed with encouragement

---

### ✅ Scenario 3: Prerequisite Gap Detection

**Goal**: Test knowledge graph prerequisite analysis

**Steps**:
1. Ask an advanced question without mastering prerequisites: `"Explain dynamic programming memoization"`

**Expected Behavior**:
- ✅ System detects prerequisites: ["Recursion", "Time Complexity", "Space Complexity"]
- ✅ Checks user's mastery profile (all 3 are low or missing)
- ✅ Prerequisites shown with ⚠️ weak/unknown status
- ✅ Recommended learning path: [Recursion] → [Time Complexity] → [Dynamic Programming]
- ✅ Answer adapts: More focus on foundational concepts, less jargon

**UI Verification**:
- Prerequisites card shows red/yellow indicators
- "You may want to review these first" message
- Click prerequisites to see definitions

---

### ✅ Scenario 4: Multilingual Support

**Goal**: Test language detection and translation

**Steps**:
1. Ask in Hindi: `"बाइनरी सर्च क्या है?"`

**Expected Behavior**:
- ✅ Language detected: "hi"
- ✅ Question translated to English internally: "What is binary search?"
- ✅ Reasoning done in English
- ✅ Final solution translated back to Hindi
- ✅ Response includes both `language: "hi"` and `original_language: "en"`

**Supported Languages**: `en`, `hi`, `es`, `fr`, `de`, `ja`, `zh`, `ar`

---

### ✅ Scenario 5: Cross-Domain Learning

**Goal**: Test universal knowledge graph (25+ disciplines)

**Test each domain**:
- Computer Science: `"What is a hash table?"`
- Mathematics: `"Explain the Pythagorean theorem"`
- Physics: `"What is Newton's second law?"`
- Chemistry: `"What is ionic bonding?"`
- Biology: `"Explain photosynthesis"`
- Economics: `"What is supply and demand?"`

**Expected Behavior**:
- ✅ Each question maps to correct discipline concept
- ✅ Prerequisites specific to domain shown
- ✅ Related concepts within domain
- ✅ Mastery tracked separately per concept

---

### ✅ Scenario 6: Mastery Progression Over Time

**Goal**: Test adaptive difficulty and mastery growth

**Steps**:
1. Ask 5 questions on same topic (e.g., sorting algorithms)
2. Observe mastery growth

**Expected Behavior**:
- ✅ First question: mastery = 0.8
- ✅ Second question (no hints): mastery → 0.84
- ✅ Third question (no hints): mastery → 0.88
- ✅ Status changes: "improving" → "mastered" (at 0.85+)
- ✅ System adapts: Gives more advanced explanations as mastery increases

**UI Verification**:
- Mastery summary in header shows progress
- Avg mastery increases
- Concepts count grows

---

### ✅ Scenario 7: Evaluation Engine (Phase 1 Core)

**Goal**: Test rubric-based assignment evaluation

**Steps**:
1. Go to http://localhost:3000/ai-agent (Assessments tab)
2. Submit a written answer to a prompt
3. Select evaluation rubric (Correctness, Reasoning, Clarity)

**API Call**:
```bash
curl -X POST http://localhost:3000/api/evaluation/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "student_work": "Binary search works by repeatedly dividing a sorted array in half...",
    "rubric": "Explain binary search algorithm",
    "concept": "Binary Search",
    "user_id": "test-user"
  }'
```

**Expected Response**:
```json
{
  "scores": {
    "correctness": 0.85,
    "reasoning_quality": 0.90,
    "clarity": 0.80
  },
  "feedback": {
    "strengths": ["Clear step-by-step explanation", "Mentioned time complexity"],
    "improvements": ["Missing edge case handling", "Could explain recursion more"]
  },
  "overall_score": 0.85,
  "grade": "B+"
}
```

---

## Key Endpoints Reference

### Backend (FastAPI - Port 8000)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/reasoning/ask` | POST | Structured Q&A with graph context |
| `/api/mastery/attempt` | POST | Record attempt and update mastery |
| `/api/mastery/profile/{user_id}` | GET | Get full mastery profile |
| `/api/evaluation/evaluate` | POST | Rubric-based assignment grading |
| `/api/graph/concept` | POST | Add concept to knowledge graph |
| `/api/graph/link` | POST | Link prerequisite relationship |
| `/api/graph/context/{concept}` | GET | Get concept's graph context |
| `/api/demo/seed-knowledge-graph` | POST | Populate graph with 200+ concepts |
| `/api/demo/metrics/learning/{user_id}` | GET | Get learning analytics |
| `/health` | GET | System health check |

### Frontend (Next.js - Port 3000)

| Page | Purpose |
|------|---------|
| `/learn` | **Main adaptive learning interface** (7-layer brain) |
| `/ai-agent` | Legacy multi-agent interface |
| `/ask` | Community question forum |
| `/communities` | Discussion boards |
| `/profile` | User profile and stats |

---

## Testing Checklist

### Core Features (Phase 1)

- [ ] Ask question → Get structured reasoning
- [ ] Prerequisites shown with mastery status
- [ ] Hint ladder with progressive reveal
- [ ] Mastery tracking updates correctly
- [ ] Weak node detection works
- [ ] Recommended learning path shown
- [ ] Multilingual support (test 2+ languages)
- [ ] Evaluation engine grades assignments
- [ ] Cross-domain questions work (5+ subjects)
- [ ] User stats display (avg mastery, concepts learned)

### Performance Metrics

- [ ] Response time < 3 seconds for reasoning
- [ ] Knowledge graph query < 500ms
- [ ] Mastery update < 100ms
- [ ] UI responsive on mobile
- [ ] No memory leaks after 10+ questions

### Edge Cases

- [ ] Very long question (>500 words) handled
- [ ] Question in unsupported language → fallback to English
- [ ] Neo4j disconnected → graceful degradation
- [ ] Invalid concept name → fuzzy match or create new
- [ ] User asks same question twice → different hints

---

## Demo Flow (For Presentations)

### 3-Minute Demo Script

**Setup (30 seconds)**:
- Open `/learn` page
- Explain: "This is our 7-layer AI brain in action"

**Demo 1 (60 seconds) - Adaptive Reasoning**:
- Ask: "What is quicksort?"
- Show:
  - Prerequisites detected (Recursion, Divide and Conquer)
  - Stepwise reasoning with 5 clear steps
  - Hint ladder (click to reveal hints progressively)
  - Mastery badge updates in real-time
  - Related concepts shown

**Demo 2 (45 seconds) - Struggling Student**:
- Ask: "Explain AVL tree rotations"
- Reveal all 3 hints
- Show:
  - Mastery score drops due to hint penalty
  - "Struggling" status with red indicator
  - Nudge: "Review Binary Search Trees first"
  - Recommended path shown

**Demo 3 (45 seconds) - Cross-Domain**:
- Ask: "Explain Newton's second law" (Physics)
- Ask: "What is mitosis?" (Biology)
- Show:
  - Knowledge graph spans 25+ disciplines
  - Mastery tracked separately per domain
  - System adapts explanation style per field

**Close (15 seconds)**:
- Show mastery summary: "3 concepts learned, avg mastery 84%"
- Explain: "This is production-ready Phase 1. Phase 2 adds teacher dashboard, mobile app, and advanced analytics."

---

## Troubleshooting

### Backend not responding

```bash
# Check if FastAPI is running
curl http://localhost:8000/health

# Expected: {"status": "healthy", "version": "2.0.0", "neo4j_connected": true}
```

### Knowledge graph empty

```bash
# Reseed the graph
curl -X POST http://localhost:8000/api/demo/seed-knowledge-graph

# Verify concepts exist
curl http://localhost:8000/api/demo/concepts
```

### Mastery not updating

- Check browser console for API errors
- Verify user is authenticated (session.user.id present)
- Check backend logs for mastery_service errors

### Prerequisites not showing

- Verify concept exists in Neo4j: `MATCH (n:Concept) WHERE n.name = "Binary Search" RETURN n`
- Check prerequisite relationships: `MATCH (n:Concept)-[:PREREQUISITE_OF]->(m) RETURN n.name, m.name LIMIT 10`

---

## Success Criteria

✅ **Phase 1 Complete When**:
1. All 7 layers working end-to-end
2. 5+ demo scenarios pass
3. Knowledge graph seeded with 200+ concepts
4. Mastery tracking accurate within ±0.05
5. Response time < 3 seconds median
6. UI shows all reasoning components correctly
7. WIP features clearly marked

🎯 **"Legs Shake" Benchmark**:
- Live demo completes all 3 scenarios without errors
- Judges see mastery scores update in real-time
- Prerequisites dynamically detected from graph
- Cross-domain questions work seamlessly
- System explains its reasoning (not just answers)

---

## Next Steps (Post-Testing)

1. Mark Phase 2 features as WIP (teacher dashboard, mobile app)
2. Add auto-seed on first startup
3. Optimize graph queries for <200ms
4. Add unit tests for mastery formulas
5. Document API with Swagger annotations
6. Create video walkthrough for judges

---

## Questions?

Check the following docs:
- [ARCHITECTURE.md](../ARCHITECTURE.md) - System design
- [README.md](../README.md) - Setup instructions
- [DEMO_SUMMARY.md](../DEMO_SUMMARY.md) - Hackathon presentation guide
- Code: `apps/ai-agent/app/services/` - All AI engines
