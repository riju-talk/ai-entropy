# Project Summary: Entropy Community Forum

## Overview
Entropy Community Forum is an AI-powered academic collaboration platform designed to revolutionize how students learn, share knowledge, and grow together. By combining cutting-edge AI, gamification, and modern web technologies, the platform creates an engaging and rewarding learning environment.

---

## Key Features

### AI-Powered Learning Assistant
- **RAG (Retrieval-Augmented Generation)** powered by LangChain & Pinecone.
- Document analysis for intelligent Q&A (PDFs, DOCX, and text files).
- Contextual answers for text, code, and mathematical queries.

### Gamification System
- **Entropy Coins**: Earned through contributions and daily activities.
- **XP & Leveling**: Progression system from Freshman to Sage.
- **Achievements & Badges**: Unlock milestones.
- **Streak System**: Rewards for consistency.
- **Leaderboards**: Compete academically.

### Community-Driven Learning
- Subject-specific communities for focused learning.
- Smart Q&A system with rich text, code snippets, and LaTeX support.
- Voting and reputation system for community-validated answers.
- Mentorship programs to connect with experienced mentors.

### Modern User Experience
- Responsive design for all devices.
- Dark/Light themes for customization.
- Real-time interactions and notifications.
- Accessible UI built with Radix UI primitives.

---

## Technologies Used

### Frontend
- **Next.js**: React-based framework for server-side rendering and static site generation.
- **TypeScript**: Strongly typed JavaScript for better developer experience.
- **TailwindCSS**: Utility-first CSS framework for rapid UI development.

### Backend
- **FastAPI**: High-performance Python web framework for building APIs.
- **Prisma**: ORM for database management and migrations.

### AI Integration
- **LangChain**: Framework for building applications with LLMs.
- **Pinecone**: Vector database for semantic search and recommendations.

---

## Live Demo
The platform is live at: [entropy-community-forum.vercel.app](https://entropy-community-forum.vercel.app/)

---

## Folder Structure

### apps/ai-agent
- Backend services for AI-powered features.
- Includes FastAPI setup, AI models, and utilities.

### apps/app
- Frontend application built with Next.js.
- Contains pages, components, hooks, and styles.

### packages/
- Shared configurations for ESLint, TypeScript, and UI components.

---

## How to Use
1. Clone the repository.
2. Install dependencies using `pnpm install`.
3. Start the development server with `pnpm dev`.
4. Access the app at `http://localhost:3000`.

---

## Contribution
Contributions are welcome! Feel free to open issues or submit pull requests to improve the platform.