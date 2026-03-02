"""
AI Agent Backend - FastAPI Application
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# CORRECT ROUTER IMPORTS
from app.api.routes.documents import router as documents_router
from app.api.routes.qa import router as qa_router
from app.api.routes.mindmap import router as mindmap_router
from app.api.routes.quiz import router as quiz_router
from app.api.routes.flashcards import router as flashcards_router

app = FastAPI(
    title="Entropy AI Agent",
    description="AI-powered learning tools backend",
    version="1.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ROUTES
app.include_router(documents_router,  prefix="/api/documents", tags=["Documents"])
app.include_router(qa_router,         prefix="/api/qa",        tags=["Q&A"])
app.include_router(mindmap_router,    prefix="/api/mindmap",   tags=["Mind Mapping"])
app.include_router(quiz_router,       prefix="/api/quiz",      tags=["Quiz"])
app.include_router(flashcards_router, prefix="/api/flashcards",tags=["Flashcards"])

@app.get("/")
async def root():
    return {
        "message": "Entropy AI Agent Backend",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "qa": "/api/qa",
            "documents_upload": "/api/documents/upload",
            "mindmap": "/api/mindmap",
            "quiz": "/api/quiz",
            "flashcards": "/api/flashcards",
        },
    }

@app.get("/health")
async def health_check():
    google_key = os.getenv("GOOGLE_API_KEY")
    pinecone_key = os.getenv("PINECONE_API_KEY")
    return {
        "status": "healthy" if google_key and pinecone_key else "degraded",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "services": {
            "llm": "gemini-1.5-flash",
            "embeddings": "gemini-embedding-001",
            "vector_store": "pinecone",
            "keys_present": {
                "google": bool(google_key),
                "pinecone": bool(pinecone_key)
            }
        },
        "message": "AI Agent is operational" if google_key else "GOOGLE_API_KEY not configured",
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)), reload=True)
