"""
DEPRECATED: Database module no longer used.
All chat history and document processing now handled by LangChain services.
This file is kept for reference only.
"""
import logging

logger = logging.getLogger(__name__)
logger.warning("⚠️  database.py is DEPRECATED - using LangChain services instead")

# All database functionality has been replaced by:
# - LangChain vector stores (Chroma) for document storage
# - File-based storage for Q&A history
# - LangChain conversation memory for chat history
