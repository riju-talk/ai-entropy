# Requirements

## Problem statement
Learners study from scattered sources and get generic AI answers that ignore who they are and what they already know. Entropy is one place to ask questions, learn from your own resources and from trusted peers, and practise, with the system remembering the learner across sessions. See `README.md` for the full problem description.

## Users
- **Learner:** asks questions, uploads resources, takes quizzes, studies with a timer.
- **Contributor:** answers other learners' doubts and earns reputation.

## Functional requirements

| ID | Requirement | Milestone |
|---|---|---|
| F1 | Ask a question and get an answer with citations to the learner's resources, community answers or web results | 1 |
| F2 | Upload documents (PDF, DOCX, TXT); they become searchable context for the learner only | 1 |
| F3 | The system remembers the learner: past sessions, mastered concepts, preferred explanation style | 1 |
| F4 | Generate quizzes at a chosen difficulty; grade answers with a rubric and explain the score | 1 |
| F5 | Focus timer (Pomodoro) attached to a topic; completed sessions update mastery | 1 |
| F6 | Generate a mind map from a question or document | 1 |
| F7 | Review queue and study plan from spaced repetition on weak concepts | 1 |
| F8 | Community: post doubts, answer, vote, reputation, achievements, leaderboard | existing |
| F9 | Generate slide decks (title, bullets, speaker notes) and export to PDF or PPTX | 2 |
| F10 | Generate interactive artifacts (HTML, SVG, Mermaid) rendered in a sandbox | 2 |
| F11 | Community answers above a trust threshold are searchable as context | 2 |

## Non-functional requirements
- **Cost:** runs on free tiers (Vercel, Render, Supabase, Neo4j Aura Free, Pinecone, Groq) with no paid cloud services.
- **Security:** every AI request is authenticated; the browser never holds the AI service token; a user can only read their own memory and documents.
- **Resilience:** if Redis, Neo4j or Pinecone is unreachable the app still answers, with reduced features. Queued work survives a restart.
- **Latency:** first token under 3 seconds when warm; the UI shows a "waking up" state during free-tier cold starts.
- **Rate limits:** per-user throttling and response caching to stay within Groq free-tier limits.
- **Reproducibility:** pinned dependencies and a green build with type and lint checks on.

## Domain concepts
- **Mastery:** a per-concept score from attempts and confidence, decaying with inactivity.
- **Memory types:** working, episodic, semantic, procedural.
- **Skill:** a single capability (explain, quiz, assess, mind map, recall, study plan) chosen by an intent router.
- **Concept graph:** concepts linked by prerequisite and related-to edges in Neo4j.

## Acceptance
Milestone 1 is done when a signed-in learner can upload a PDF, ask a question about it and get a cited answer, take a quiz on it, finish a timed study session, and see the next session adapt to that history, all on the deployed free-tier stack.

## Constraints
- LLM: Groq through LangChain. Embeddings: fastembed (local, 384 dimensions).
- Queues: in-process, no external queue service.
- Hosting: Next.js on Vercel, FastAPI on Render.
