from langchain_google_genai import ChatGoogleGenerativeAI
from typing import Optional
import os

from app.config import settings
from app.utils.logger import setup_logger

logger = setup_logger(__name__)

_llm_instance: Optional[ChatGoogleGenerativeAI] = None


def get_llm() -> ChatGoogleGenerativeAI:
    """
    Get LLM instance (Gemini client)
    """
    global _llm_instance

    if _llm_instance is None:
        logger.info(f"Initializing Gemini LLM: {settings.LLM_MODEL}")
        
        api_key = settings.GOOGLE_API_KEY
        if not api_key:
            raise ValueError("GOOGLE_API_KEY is missing in the configuration")

        _llm_instance = ChatGoogleGenerativeAI(
            model=settings.LLM_MODEL,
            google_api_key=api_key,
            temperature=settings.LLM_TEMPERATURE,
            convert_system_message_to_human=True
        )
        logger.info("Gemini LLM initialized successfully")

    return _llm_instance


async def generate_response(
    prompt: str,
    system_prompt: str = "You are a helpful AI tutor.",
    max_tokens: int = None,
    temperature: float = None
) -> str:
    llm = get_llm()

    # Build messages list
    messages = [
        ("system", system_prompt),
        ("human", prompt)
    ]

    try:
        output = await llm.ainvoke(messages)
        return output.content.strip()

    except Exception as e:
        logger.error(f"Gemini API error: {e}")
        raise Exception(f"Failed to generate response: {str(e)}")


async def generate_with_context(
    question: str,
    context: str,
    system_prompt: str = "You are a helpful AI tutor."
) -> str:
    """Generate response with context (for RAG)"""
    prompt = f"""Context information:
{context}

Question: {question}

Answer the question based on the context provided above. If the context doesn't contain enough information, provide the best answer you can and mention that additional context would be helpful."""
    
    return await generate_response(prompt, system_prompt)
