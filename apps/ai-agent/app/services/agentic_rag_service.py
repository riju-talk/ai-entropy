"""
Advanced Agentic RAG with LangGraph - Multi-step reasoning with retrieval
"""
import logging
from typing import List, Dict, Any, Optional, TypedDict
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langchain_core.documents import Document
from langgraph.graph import StateGraph, START, END
from app.services.langchain_service import langchain_service

logger = logging.getLogger(__name__)


class RAGState(TypedDict):
    """State for agentic RAG workflow"""
    question: str
    retrieved_docs: List[Document]
    context: str
    initial_answer: str
    needs_refinement: bool
    refined_answer: str
    final_answer: str
    sources: List[Dict]
    mode: str


class AgenticRAGService:
    """Advanced RAG with multi-agent workflow using LangGraph"""
    
    def __init__(self):
        if not langchain_service:
            raise RuntimeError("LangChain service not available")
        self.langchain = langchain_service
        self.workflow = self._build_workflow()
        logger.info("✅ Agentic RAG service initialized")
    
    def _build_workflow(self) -> StateGraph:
        """Build the agentic RAG workflow graph"""
        workflow = StateGraph(RAGState)
        
        # Add nodes
        workflow.add_node("retrieve_documents", self._retrieve_documents)
        workflow.add_node("generate_initial_answer", self._generate_initial_answer)
        workflow.add_node("refine_answer", self._refine_answer)
        workflow.add_node("polish_final_answer", self._polish_final_answer)
        
        # Add edges
        workflow.add_edge(START, "retrieve_documents")
        workflow.add_edge("retrieve_documents", "generate_initial_answer")
        
        # Conditional edge based on quality check
        workflow.add_conditional_edges(
            "generate_initial_answer",
            self._check_answer_quality,
            {
                "refine": "refine_answer",
                "finalize": "polish_final_answer"
            }
        )
        
        workflow.add_edge("refine_answer", "polish_final_answer")
        workflow.add_edge("polish_final_answer", END)
        
        return workflow.compile()
    
    def _retrieve_documents(self, state: RAGState) -> Dict[str, Any]:
        """Step 1: Retrieve relevant documents"""
        logger.info(f"🔍 Retrieving documents for: {state['question'][:50]}...")
        
        try:
            vector_store = self.langchain.load_vector_store("default")
            
            if vector_store:
                retriever = vector_store.as_retriever(search_kwargs={"k": 6})
                docs = retriever.invoke(state["question"])
                
                context = "\n\n---\n\n".join([
                    f"Document {i+1}:\n{doc.page_content}" 
                    for i, doc in enumerate(docs)
                ])
                
                sources = [
                    {"content": doc.page_content[:200] + "...", "metadata": doc.metadata}
                    for doc in docs
                ]
                
                logger.info(f"✅ Retrieved {len(docs)} documents")
                
                return {
                    "retrieved_docs": docs,
                    "context": context,
                    "sources": sources,
                    "mode": "rag"
                }
            else:
                logger.info("⚠️  No vector store found, using direct mode")
                return {
                    "retrieved_docs": [],
                    "context": "",
                    "sources": [],
                    "mode": "direct"
                }
        
        except Exception as e:
            logger.error(f"Retrieval error: {e}")
            return {
                "retrieved_docs": [],
                "context": "",
                "sources": [],
                "mode": "direct"
            }
    
    def _generate_initial_answer(self, state: RAGState) -> Dict[str, Any]:
        """Step 2: Generate initial answer"""
        logger.info("💭 Generating initial answer...")
        
        if state["mode"] == "rag" and state["context"]:
            prompt = f"""You are Spark, an AI study assistant. Use the following context to answer the question accurately.

Context:
{state['context']}

Question: {state['question']}

Instructions:
- Base your answer on the provided context
- If the context doesn't contain relevant information, say so
- Format in clear Markdown
- Be concise but thorough

Answer:"""
        else:
            prompt = f"""You are Spark, an AI study assistant.

Question: {state['question']}

Answer in clear Markdown format:"""
        
        response = self.langchain.llm.invoke([HumanMessage(content=prompt)])
        
        logger.info("✅ Initial answer generated")
        return {"initial_answer": response.content.strip()}
    
    def _check_answer_quality(self, state: RAGState) -> str:
        """Gate: Check if answer needs refinement"""
        answer = state["initial_answer"]
        
        # Quality checks
        needs_refinement = False
        
        # Check 1: Too short (< 50 chars)
        if len(answer) < 50:
            needs_refinement = True
            logger.info("⚠️  Answer too short - needs refinement")
        
        # Check 2: No proper formatting
        elif not any(marker in answer for marker in ["##", "**", "*", "-", "1."]):
            needs_refinement = True
            logger.info("⚠️  Answer lacks formatting - needs refinement")
        
        # Check 3: Generic response
        elif any(phrase in answer.lower() for phrase in ["i don't know", "no information", "cannot answer"]):
            needs_refinement = True
            logger.info("⚠️  Answer seems generic - needs refinement")
        
        return "refine" if needs_refinement else "finalize"
    
    def _refine_answer(self, state: RAGState) -> Dict[str, Any]:
        """Step 3: Refine the answer with more detail"""
        logger.info("🔧 Refining answer...")
        
        refinement_prompt = f"""The following answer needs improvement. Make it more detailed, well-formatted, and helpful.

Original Question: {state['question']}

Current Answer:
{state['initial_answer']}

Instructions:
- Add more detail and examples
- Improve Markdown formatting with headings, lists, and emphasis
- Make it more educational and engaging
- Keep it accurate and relevant

Improved Answer:"""
        
        response = self.langchain.llm.invoke([HumanMessage(content=refinement_prompt)])
        
        logger.info("✅ Answer refined")
        return {"refined_answer": response.content.strip()}
    
    def _polish_final_answer(self, state: RAGState) -> Dict[str, Any]:
        """Step 4: Final polish and formatting"""
        logger.info("✨ Polishing final answer...")
        
        # Use refined answer if available, otherwise use initial
        base_answer = state.get("refined_answer", state["initial_answer"])
        
        polish_prompt = f"""Add a final polish to this answer. Make it shine! 🌟

Question: {state['question']}

Current Answer:
{base_answer}

Instructions:
- Ensure perfect Markdown formatting
- Add emojis where appropriate for engagement
- Make sure it's clear, concise, and helpful
- Add a brief summary or key takeaway at the end if helpful

Polished Answer:"""
        
        response = self.langchain.llm.invoke([HumanMessage(content=polish_prompt)])
        
        logger.info("✅ Final answer polished")
        return {"final_answer": response.content.strip()}
    
    async def process_question(
        self,
        question: str,
        collection_name: str = "default",
        user_id: str = "anonymous",
        system_prompt: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """
        Process a question with RAG workflow.
        
        Args:
            question: The user's question
            collection_name: Vector store collection to query
            user_id: User identifier for context/logging
            system_prompt: Optional custom system prompt
            conversation_history: Optional chat history for context
        """
        try:
            logger.info(f"Processing question for user {user_id} with collection {collection_name}")
            
            # Try to load vector store for RAG
            vector_store = None
            try:
                vector_store = self.langchain.load_vector_store(collection_name)
                if vector_store:
                    logger.info(f"Loaded vector store for collection: {collection_name}")
            except Exception as e:
                logger.warning(f"Could not load vector store: {e}")
            
            # Use RAG if vector store available, otherwise direct chat
            if vector_store:
                result = await self.langchain.rag_chat(
                    message=question,
                    vector_store=vector_store,
                    system_prompt=system_prompt or "You are a helpful AI assistant. Answer based on the provided context."
                )
                mode = "rag"
                sources = result.get("sources", [])
            else:
                result = await self.langchain.direct_chat(
                    message=question,
                    conversation_history=conversation_history or [],
                    system_prompt=system_prompt or "You are a helpful AI assistant."
                )
                mode = "direct"
                sources = []
            
            return {
                "answer": result.get("answer", ""),
                "sources": sources,
                "mode": mode,
                "workflow_info": {
                    "user_id": user_id,
                    "collection_name": collection_name,
                    "used_vector_store": vector_store is not None
                }
            }
            
        except Exception as e:
            logger.error(f"Error in process_question: {e}", exc_info=True)
            raise


# Create singleton
logger.info("Creating Agentic RAG service...")
try:
    agentic_rag_service = AgenticRAGService()
    logger.info("✅ Agentic RAG service created")
except Exception as e:
    logger.error(f"❌ Failed to create Agentic RAG service: {e}")
    agentic_rag_service = None
