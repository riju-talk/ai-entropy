"""
Groq AI service using LangChain framework
"""
import json
from typing import List, Dict, Any, Optional
import logging

# Prefer newer langchain_core.messages when available; fall back gracefully to avoid import errors
try:
    from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
except Exception:
    HumanMessage = SystemMessage = AIMessage = None  # type: ignore

logger = logging.getLogger(__name__)

# Spark's personality
SPARK_PERSONALITY = """You are Spark, an enthusiastic and friendly AI learning companion! 🌟

Your personality:
- Warm, encouraging, and patient
- Use emojis occasionally to make learning fun
- Break down complex topics into digestible pieces
- Ask guiding questions to help students think critically
- Celebrate small wins and progress
- Provide hints before direct answers
- Share interesting facts and real-world applications

Remember: You're inspiring curiosity and making learning enjoyable!"""


class GroqService:
    """Service for educational content generation using LangChain"""
    
    def __init__(self):
        # Lazily import the langchain_service to avoid import-time failures
        try:
            import importlib
            mod = importlib.import_module("app.services.langchain_service")
            lc = getattr(mod, "langchain_service", None)
            if not lc:
                raise RuntimeError("LangChain service not initialized")
            self.langchain = lc
            logger.info("✅ Groq service initialized with LangChain (lazy import)")
        except Exception as e:
            logger.error("LangChain not available for GroqService: %s", e)
            # Re-raise so module-level creation can decide how to handle absence
            raise
    
    async def generate_quiz(
        self,
        topic: str,
        num_questions: int = 5,
        difficulty: str = "medium",
        custom_prompt: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Generate quiz questions"""
        try:
            system_prompt = custom_prompt or f"""You are Spark, an educational AI assistant.

Generate EXACTLY {num_questions} multiple-choice questions about "{topic}" at {difficulty} difficulty level.

CRITICAL REQUIREMENTS:
1. Return ONLY a valid JSON array, no markdown fences, no explanations
2. Each question MUST have exactly 4 options labeled A, B, C, D
3. correctAnswer must be the index (0-3) of the correct option
4. Include a clear explanation for each answer

JSON format:
[{{"question": "...", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "correctAnswer": 0, "explanation": "..."}}]

Generate {num_questions} questions now:"""

            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=f"Generate {num_questions} {difficulty} quiz questions about: {topic}")
            ]
            
            # Direct LLM invocation
            response = self.langchain.llm.invoke(messages)
            content = response.content
            
            # Clean and parse JSON
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            
            questions = json.loads(content)
            logger.info(f"✅ Generated {len(questions)} quiz questions")
            return questions
            
        except Exception as e:
            logger.error(f"Quiz generation error: {e}")
            return [{"question": f"Error: {str(e)}", "options": ["A", "B", "C", "D"], "correctAnswer": 0, "explanation": "Error"}]
    
    async def generate_mindmap(
        self,
        topic: str,
        diagram_type: str = "mindmap",
        custom_prompt: Optional[str] = None
    ) -> str:
        """Generate Mermaid diagram"""
        try:
            system_prompt = custom_prompt or f"""Create a {diagram_type} diagram for {topic}.
Return ONLY valid Mermaid syntax without markdown formatting."""

            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=f"Create {diagram_type} for: {topic}")
            ]

            # Try multiple invocation methods on langchain_service (compatibility)
            content = None

            # Preferred: langchain_service.invoke_llm (async)
            try:
                if hasattr(self.langchain, "invoke_llm"):
                    content = await self.langchain.invoke_llm(messages, temperature=0.7, max_tokens=1500)
                else:
                    raise AttributeError("invoke_llm not available")
            except Exception:
                # Fallback: try langchain_service.llm.invoke (sync or async)
                try:
                    if hasattr(self.langchain, "llm") and hasattr(self.langchain.llm, "invoke"):
                        resp = self.langchain.llm.invoke(messages)
                        # resp may be object with .content or string
                        content = getattr(resp, "content", resp)
                        # if it's awaitable
                        if hasattr(content, "__await__"):
                            content = await content
                    else:
                        raise AttributeError("llm.invoke not available")
                except Exception:
                    # Final fallback: try generic call/invoke function names
                    try:
                        if hasattr(self.langchain, "call"):
                            content = await self.langchain.call(messages, temperature=0.7, max_tokens=1500)
                        elif hasattr(self.langchain, "invoke"):
                            content = await self.langchain.invoke(messages, temperature=0.7, max_tokens=1500)
                        else:
                            raise RuntimeError("No supported LLM invocation method on langchain_service")
                    except Exception as e:
                        logger.error("Failed to invoke LLM via langchain_service: %s", e, exc_info=True)
                        raise

            # content may be Response-like or plain string
            if isinstance(content, (dict, list)):
                # try to extract text field if present
                content_text = content.get("content") if isinstance(content, dict) else None
                if not content_text:
                    content_text = str(content)
            else:
                content_text = getattr(content, "content", None) or str(content)

            # Clean Mermaid code from code fences if present
            if "```mermaid" in content_text:
                content_text = content_text.split("```mermaid", 1)[1].split("```", 1)[0].strip()
            elif "```" in content_text:
                # take first fenced block
                content_text = content_text.split("```", 1)[1].split("```", 1)[0].strip()

            logger.info(f"✅ Generated {diagram_type}")
            return content_text

        except Exception as e:
            logger.error(f"Mindmap error: {e}", exc_info=True)
            # Return a helpful error string rather than raising to keep UI feedback simple
            raise
    
    async def generate_flashcards(
        self,
        topic: str,
        count: int = 10,
        custom_prompt: Optional[str] = None
    ) -> List[Dict[str, str]]:
        """Generate flashcards"""
        try:
            system_prompt = custom_prompt or f"""You are Spark, an educational AI assistant.

Generate EXACTLY {count} flashcards about "{topic}".

CRITICAL REQUIREMENTS:
1. Return ONLY a valid JSON array, no markdown fences
2. Each flashcard MUST have "front" (question) and "back" (answer)
3. Keep content concise and educational

JSON format: [{{"front": "Question or concept", "back": "Answer or explanation"}}]

Generate {count} flashcards now:"""

            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=f"Create {count} flashcards for: {topic}")
            ]
            
            # Direct LLM invocation
            response = self.langchain.llm.invoke(messages)
            content = response.content
            
            # Clean and parse
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            
            flashcards = json.loads(content)
            
            # Ensure exactly count flashcards
            if len(flashcards) < count:
                logger.warning(f"Only {len(flashcards)} flashcards generated, padding...")
                while len(flashcards) < count:
                    flashcards.append({
                        "front": f"Concept {len(flashcards)+1} about {topic}",
                        "back": f"Explanation for concept {len(flashcards)+1}"
                    })
            
            flashcards = flashcards[:count]
            logger.info(f"✅ Generated {len(flashcards)} flashcards")
            return flashcards
            
        except Exception as e:
            logger.error(f"Flashcard error: {e}")
            return [{"front": f"Concept {i+1}: {topic}", "back": f"Explanation {i+1}"} for i in range(count)]
    
    async def answer_question(
        self,
        question: str,
        context: Optional[str] = None,
        custom_prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """Answer question"""
        try:
            system_prompt = custom_prompt or "You are a helpful AI tutor. Answer clearly and educationally."
            user_message = f"Context: {context}\n\nQuestion: {question}" if context else question
            
            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_message)
            ]
            
            answer = await self.langchain.invoke_llm(messages, temperature=0.7, max_tokens=1000)
            
            return {"answer": answer, "confidence": 0.95}
            
        except Exception as e:
            logger.error(f"Q&A error: {e}")
            return {"answer": f"Error: {str(e)}", "confidence": 0.0}
    
    async def chat(
        self,
        message: str,
        conversation_history: List[Dict[str, str]] = None,
        custom_prompt: Optional[str] = None
    ) -> str:
        """Chat with Spark"""
        try:
            system_prompt = custom_prompt or SPARK_PERSONALITY
            messages = [SystemMessage(content=system_prompt)]
            
            # Add history
            if conversation_history:
                for msg in conversation_history:
                    if msg["role"] == "user":
                        messages.append(HumanMessage(content=msg["content"]))
                    elif msg["role"] == "assistant":
                        messages.append(AIMessage(content=msg["content"]))
            
            messages.append(HumanMessage(content=message))
            
            reply = await self.langchain.invoke_llm(messages, temperature=0.8, max_tokens=1000)
            logger.info("✅ Chat response generated")
            return reply
            
        except Exception as e:
            logger.error(f"Chat error: {e}")
            return f"Error: {str(e)}"
    
    async def get_greeting(self) -> str:
        """Get greeting"""
        return "Hi! I'm Spark ⚡ - your AI study buddy! What would you like to explore today?"


# Create singleton
logger.info("Creating Groq service...")
try:
    groq_service = GroqService()
    logger.info("✅ Groq service created")
except Exception as e:
    logger.error(f"❌ Failed to create Groq service: {e}")
    groq_service = None