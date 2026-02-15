# Software Requirements Specification (SRS)

## Project
**ENTROPY – AI Learning Acceleration Platform**

**Version:** 1.0  
**Date:** 2026-02-16  
**Prepared For:** AI for Bharat learning ecosystem

---

## System Overview
ENTROPY is an AI-powered learning and developer productivity platform that accelerates understanding of complex technical concepts for students, developers, researchers, and educators. The platform combines AI explanation workflows, document intelligence, graph-based reasoning, adaptive learning paths, community collaboration, gamification, and multilingual support tailored for Indian learners.

The platform is designed as a web-based system with a Next.js frontend and FastAPI backend, supported by hybrid storage and retrieval systems (vector databases, graph database, relational and document databases). It uses a custom Retrieval-Augmented Generation (RAG) architecture without LangChain.

Core capability pillars:
1. AI Learning Engine
2. Document Intelligence
3. Knowledge Graph Reasoning
4. Community Learning and Mentorship
5. Gamified Learning Progression
6. Multilingual Learning Support

---

## Objectives
1. Reduce time-to-understanding for technical topics using AI-guided explanations and concept sequencing.
2. Detect learner knowledge gaps and generate adaptive learning paths personalized to current skill level and goals.
3. Enable deep comprehension of uploaded technical material (PDF, DOCX, TXT) through contextual Q&A and summarization.
4. Improve conceptual reasoning using a knowledge graph that captures concepts, dependencies, and relationships.
5. Foster collaborative growth through subject communities, Q&A, and mentor-learner connections.
6. Increase engagement and retention with gamification (XP, entropy coins, levels, achievements, leaderboards).
7. Provide multilingual support for Indian learners with regional language explanation and translation capabilities.
8. Ensure production-readiness through high scalability, availability, low latency, security, and accessibility.

---

## Scope
### In Scope
- Web platform for authenticated users (students, developers, researchers, educators).
- AI assistant for technical Q&A and code explanation.
- Knowledge gap detection and adaptive learning path generation.
- Upload and analysis of PDF, DOCX, TXT documents.
- Context-aware question answering over uploaded documents.
- Knowledge graph construction, relationship mapping, and recommendation generation.
- Community modules: subject groups, threaded Q&A, mentorship matching.
- Gamification mechanics: XP, entropy coins, levels, achievements, leaderboards.
- Multilingual translation and regional language support for explanations.
- Administrative capabilities for moderation, configuration, and analytics.

### Out of Scope (Initial Release)
- Native mobile applications (iOS/Android).
- Offline-first mode and local model execution on user devices.
- Real-time video conferencing for mentorship sessions.
- External LMS integrations beyond basic import/export.
- Blockchain/NFT-based reward systems.

---

## User Personas
1. **Student (Beginner to Intermediate)**
   - Needs clear conceptual explanations and guided progression.
   - Prefers examples, visual relationships, and native language support.

2. **Developer (Intermediate to Advanced)**
   - Needs code-level explanations, architecture clarifications, and quick references.
   - Values productivity features and low-latency responses.

3. **Researcher**
   - Needs document intelligence, synthesis, and citation-aware understanding.
   - Requires traceability of concept links and source grounding.

4. **Educator/Mentor**
   - Needs tools to guide learners, monitor progress, and answer domain questions.
   - Needs community moderation and curated learning pathways.

5. **Multilingual Indian Learner**
   - Needs explanation translation in regional languages.
   - Needs mixed-language support for technical terminology.

---

## Functional Requirements

### FR-1: AI Learning Engine
**FR-1.1 Ask Questions and AI Explanations**
- Users shall submit natural language questions and receive AI-generated technical explanations.
- Responses shall include concise answer, expanded explanation, and optional examples.
- The system shall provide source context when generated via retrieval.

**FR-1.2 Knowledge Gap Detection**
- The system shall infer missing prerequisite concepts based on user queries, quiz outcomes, and interaction history.
- The system shall present identified gaps with confidence indicators.

**FR-1.3 Adaptive Learning Path Generation**
- The system shall generate personalized topic sequences based on user goal, current skill, and knowledge gaps.
- Paths shall be dynamically recalculated after major user progress events.

**FR-1.4 Code Explanation Support**
- Users shall submit code snippets and ask for explanations, complexity insights, and improvement suggestions.
- The system shall support common languages used in AI/ML and software engineering workflows.

**FR-1.5 Knowledge Graph Reasoning**
- The engine shall use concept-relation graphs to enrich answers, suggest prerequisites, and recommend next topics.

### FR-2: Document Intelligence
**FR-2.1 Document Upload**
- Users shall upload PDF, DOCX, and TXT documents.
- System shall validate file type, size, and malware/security checks before processing.

**FR-2.2 Parsing and Analysis**
- The system shall extract text, metadata, and section hierarchy from uploaded documents.
- OCR fallback shall be applied where scanned document text extraction is needed.

**FR-2.3 Contextual Q&A**
- Users shall ask questions scoped to specific documents or document sets.
- Responses shall be grounded on retrieved chunks with traceable references.

**FR-2.4 Research Understanding**
- System shall provide summarization, key findings, concept extraction, and section-level explainability for research materials.

### FR-3: Knowledge Graph System
**FR-3.1 Concept Extraction**
- The system shall extract domain concepts from user interactions and documents.

**FR-3.2 Relationship Mapping**
- The system shall map relationships such as prerequisite_of, related_to, derived_from, and application_of.

**FR-3.3 Graph-based Recommendations**
- The system shall generate recommendations for next concepts, resources, and exercises using graph traversal and ranking strategies.

### FR-4: Community Platform
**FR-4.1 Subject-specific Communities**
- Users shall join topic-based communities (e.g., NLP, GenAI, Data Structures).

**FR-4.2 Q&A Discussions**
- Users shall create posts, ask/answer questions, upvote, and mark accepted answers.

**FR-4.3 Mentorship Connections**
- Users shall request mentorship and mentors shall discover mentees by domain, level, and goals.

### FR-5: Gamification
**FR-5.1 XP and Entropy Coins**
- System shall award XP and entropy coins for learning milestones, helpful contributions, and consistency.

**FR-5.2 Levels and Achievements**
- System shall maintain user levels and achievement badges with transparent unlock criteria.

**FR-5.3 Leaderboards**
- System shall provide periodic leaderboards by global rank, community, and domain.

### FR-6: Multilingual Support
**FR-6.1 Translation of Explanations**
- Users shall translate AI explanations into supported Indian regional languages.

**FR-6.2 Regional Language Support**
- System shall support multilingual prompts and responses with fallback to English when confidence is low.

### FR-7: Authentication and Profile
- Users shall authenticate via secure login and maintain profile preferences (language, goals, level).
- Role-based access control shall apply for learner, mentor, and admin permissions.

### FR-8: Administration and Moderation
- Admin users shall moderate community content, manage abuse reports, and configure platform-level settings.
- Admin users shall access operational dashboards for adoption, engagement, and model quality metrics.

---

## Non Functional Requirements

### NFR-1 Scalability
- System shall support horizontal scaling for API, retrieval, and inference workloads.
- System shall handle at least 100,000 registered users and 10,000 concurrent active sessions in target deployment.

### NFR-2 High Availability
- Platform availability target shall be >= 99.9% monthly uptime excluding planned maintenance.
- Critical services shall have failover and health-based restart policies.

### NFR-3 Low Latency
- P95 response time for standard AI Q&A shall be <= 3.5 seconds under normal load.
- P95 document query response shall be <= 5 seconds for indexed documents.

### NFR-4 Security and Authentication
- All data in transit shall use TLS 1.2+.
- Sensitive data at rest shall be encrypted.
- Authentication shall support secure token/session handling and RBAC.
- The platform shall implement input validation, rate limiting, and abuse prevention controls.

### NFR-5 Accessibility
- Frontend shall meet WCAG 2.1 AA standards for key workflows.
- Keyboard navigation and screen-reader compatibility shall be supported.

### NFR-6 Performance Optimization
- Retrieval and inference layers shall implement caching where applicable.
- Background jobs shall process large document indexing asynchronously.

### NFR-7 Reliability and Data Integrity
- System shall provide retry mechanisms and idempotency for critical writes.
- Daily backups and restore verification procedures shall be implemented.

### NFR-8 Observability
- Platform shall expose logs, metrics, and traces for major services.
- Alerting shall be configured for error rate spikes, latency degradation, and service downtime.

### NFR-9 Maintainability
- Services shall follow modular architecture with clear API contracts.
- CI/CD pipelines shall include linting, unit tests, and integration checks.

### NFR-10 Privacy and Compliance
- Data collection shall follow least-privilege principles.
- User data export/deletion workflows shall be supported per policy requirements.

---

## User Stories
1. As a student, I want to ask a technical question in simple language so that I can understand difficult topics quickly.
2. As a learner, I want the platform to identify my missing prerequisites so that I can fill knowledge gaps efficiently.
3. As a learner, I want a personalized step-by-step learning path so that I can progress toward my goals.
4. As a developer, I want AI to explain code snippets so that I can debug and optimize faster.
5. As a researcher, I want to upload papers and ask contextual questions so that I can extract key insights quickly.
6. As a learner, I want concept relationship maps so that I can understand how topics connect.
7. As a user, I want to join domain communities so that I can discuss and learn collaboratively.
8. As a mentee, I want to connect with mentors in my subject area so that I can receive targeted guidance.
9. As an engaged learner, I want XP, coins, and achievements so that learning feels rewarding.
10. As an Indian learner, I want explanations in my regional language so that I can understand complex ideas better.
11. As an educator, I want to track learner progress and common gaps so that I can provide better support.
12. As an admin, I want moderation controls so that community discussions remain safe and high-quality.

---

## Acceptance Criteria

### AC-1 AI Q&A
- Given an authenticated user submits a valid technical query, when processing completes, then the system returns a relevant explanation and optional source-backed context.
- Given unsupported or unsafe prompts, then the system returns safe fallback messaging.

### AC-2 Knowledge Gap Detection and Adaptive Paths
- Given sufficient learner interaction history, when a gap analysis is requested, then the system presents at least one prerequisite gap with rationale.
- Given gap closure events, when path refresh is triggered, then recommended next topics are updated accordingly.

### AC-3 Document Intelligence
- Given valid PDF/DOCX/TXT upload, when ingestion completes, then document content is indexed and queryable.
- Given a document-scoped question, then the answer includes references to relevant sections/chunks.

### AC-4 Knowledge Graph Recommendations
- Given extracted concepts and mapped relationships, when recommendations are requested, then the system returns ranked concept/resource suggestions.

### AC-5 Community and Mentorship
- Given a user joins a community, then user can post, answer, and receive engagement interactions.
- Given mentorship preferences are submitted, then the system returns compatible mentor/mentee suggestions.

### AC-6 Gamification
- Given completion of eligible actions, then XP and entropy coins are awarded per configured rules.
- Given milestone thresholds are met, then level/achievement state updates are visible on profile.

### AC-7 Multilingual Support
- Given a generated explanation, when user selects a supported language, then translated output is displayed within acceptable quality threshold.

### AC-8 Non-Functional
- Under expected load test conditions, platform meets latency, uptime, and error budget thresholds defined in NFRs.
- Security tests verify authentication, authorization, and common vulnerability protections.

---

## Assumptions
1. Users have stable internet connectivity and modern browser support.
2. Third-party AI/model providers and managed services meet their published SLAs.
3. Training and inference data pipelines are legally and ethically sourced.
4. Initial release focuses on web app delivery; native mobile is deferred.
5. Supported regional languages are prioritized in phases based on demand and model quality.
6. Organization provides moderation and support staff for community operations.

---

## Constraints
1. **Technology Constraint:** Frontend uses Next.js + TypeScript + TailwindCSS; backend uses FastAPI.
2. **AI Pipeline Constraint:** RAG implementation must be custom and not built on LangChain abstractions.
3. **Data Store Constraint:** PostgreSQL and MongoDB are primary databases; Neo4j for graph storage; Pinecone/FAISS for vectors.
4. **Budget/Resource Constraint:** Model inference and vector operations must remain within operational cost limits.
5. **Compliance Constraint:** Data governance, security, and privacy requirements constrain telemetry and retention design.
6. **Time Constraint:** MVP scope prioritizes core learning, document intelligence, and multilingual baseline.

---

## System Limitations
1. AI-generated explanations may occasionally be incomplete or factually incorrect and require user verification.
2. Response quality depends on retrieval quality, document quality, and model capability.
3. Regional language quality may vary by domain-specific terminology and model confidence.
4. Large/complex documents may require longer indexing times before full Q&A quality is achieved.
5. Mentorship matching quality depends on available mentor pool and profile completeness.
6. Leaderboard and gamification mechanics may incentivize quantity over quality without careful moderation.
7. Graph reasoning output is bounded by extracted concept coverage and relationship accuracy.

---

## Technology Stack (Reference)
- **Frontend:** Next.js, TypeScript, TailwindCSS
- **Backend:** FastAPI (Python)
- **AI Stack:** Custom RAG pipeline, transformer embeddings, Pinecone/FAISS, Neo4j, NetworkX, spaCy, PyMuPDF, LLM inference engine
- **Databases:** PostgreSQL, MongoDB

---

## Requirement Traceability Summary (High Level)
- AI Learning Engine: FR-1, AC-1, AC-2
- Document Intelligence: FR-2, AC-3
- Knowledge Graph: FR-3, AC-4
- Community & Mentorship: FR-4, AC-5
- Gamification: FR-5, AC-6
- Multilingual: FR-6, AC-7
- Platform Qualities: NFR-1..NFR-10, AC-8
