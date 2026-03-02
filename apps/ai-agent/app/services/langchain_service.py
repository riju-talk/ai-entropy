"""
Core LangChain service with RAG capabilities - Using latest LangChain API
"""
import logging
import json
from typing import List, Dict, Any, Optional
from pathlib import Path
import re
import os

logger = logging.getLogger(__name__)

# Determine debug mode: prefer explicit settings.debug, fallback to env var DEBUG_LANGCHAIN
_DEBUG_LANGCHAIN = getattr(__import__("app.core.config", fromlist=["settings"]).settings, "debug", False) or os.getenv("DEBUG_LANGCHAIN") == "1"

# Replace loud prints with logger calls, conditional on debug
if _DEBUG_LANGCHAIN:
    logger.info("=" * 80)
    logger.info("🔵 LOADING LANGCHAIN_SERVICE MODULE (debug mode)")
    logger.info("=" * 80)

# Import with latest LangChain API - NO DEPRECATED CHAINS
try:
    logger.info("Importing ChatGoogleGenerativeAI...")
    from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
    logger.info("Importing core messages...")
    from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
    logger.info("Importing documents...")
    from langchain_core.documents import Document
    logger.info("Importing prompts...")
    from langchain_core.prompts import ChatPromptTemplate
    logger.info("Importing text splitters...")
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    logger.info("Importing Pinecone...")
    from langchain_pinecone import PineconeVectorStore
    from pinecone import Pinecone, ServerlessSpec
    logger.info("Importing config...")
    from app.core.config import settings
    logger.info("Importing MINDMAP_PROMPT...")
    from app.core.prompts import MINDMAP_PROMPT  # new import
    
    logger.info("✅ All imports successful (langchain_service)")
except Exception as e:
    logger.exception("Import error in langchain_service: %s", e)
    raise

SPARK_PERSONALITY = """You are Spark, an enthusiastic AI learning companion! 🌟
Format responses in clean Markdown with headings, lists, code blocks, and emphasis."""


class LangChainService:
    """Core LangChain service with modern API - Gemini & Pinecone"""
    
    def __init__(self):
        try:
            logger.info("🔧 Initializing LangChain service...")
            
            # Validate API keys
            if not settings.GOOGLE_API_KEY:
                raise ValueError("Missing GOOGLE_API_KEY!")
            if not settings.PINECONE_API_KEY:
                raise ValueError("Missing PINECONE_API_KEY!")
            
            # Initialize LLM (Gemini)
            logger.info(f"Initializing Gemini ({settings.LLM_MODEL})...")
            self.llm = ChatGoogleGenerativeAI(
                model=settings.LLM_MODEL,
                google_api_key=settings.GOOGLE_API_KEY,
                temperature=settings.LLM_TEMPERATURE,
                convert_system_message_to_human=True # Gemini sometimes prefers this
            )
            logger.info("✅ Gemini initialized")

            # Initialize Embeddings (Gemini)
            logger.info("Initializing Gemini Embeddings...")
            self.embeddings = GoogleGenerativeAIEmbeddings(
                model=settings.EMBEDDING_MODEL,
                google_api_key=settings.GOOGLE_API_KEY
            )
            logger.info("✅ Gemini Embeddings initialized")

            # Initialize Pinecone Client
            logger.info("Initializing Pinecone...")
            self.pc = Pinecone(api_key=settings.PINECONE_API_KEY)
            self.index_name = settings.PINECONE_INDEX_NAME
            
            # Create index if not exists (serverless spec)
            existing_indexes = [i.name for i in self.pc.list_indexes()]
            if self.index_name not in existing_indexes:
                logger.info(f"Creating Pinecone index '{self.index_name}'...")
                self.pc.create_index(
                    name=self.index_name,
                    dimension=768, # Gemini embedding-001 dimension
                    metric='cosine',
                    spec=ServerlessSpec(
                        cloud='aws',
                        region=settings.PINECONE_ENV
                    )
                )
                logger.info("✅ Pinecone Index Created")
            else:
                logger.info(f"✅ Pinecone Index '{self.index_name}' found")

            # Initialize text splitter
            self.text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=settings.chunk_size,
                chunk_overlap=settings.chunk_overlap,
            )
            logger.info("✅ Text splitter initialized")

            # Debug Test
            if _DEBUG_LANGCHAIN:
                logger.info("=" * 80)
                logger.info("✅ LANGCHAIN SERVICE INITIALIZED SUCCESSFULLY (debug)")
                logger.info("=" * 80)

        except Exception as e:
            logger.exception("❌ INITIALIZATION FAILED: %s", e)
            raise
    
    async def chat_with_fallback(
        self,
        message: str,
        collection_name: str = "default",
        conversation_history: List[Dict[str, str]] = None,
        system_prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """Bulletproof chat with RAG fallback"""
        try:
            vector_store = self.load_vector_store(collection_name)
            
            if vector_store:
                logger.info("📖 Using RAG")
                return await self.rag_chat(message, vector_store, system_prompt)
            else:
                logger.info("💬 Using direct chat")
                return await self.direct_chat(message, conversation_history, system_prompt)
                
        except Exception as e:
            logger.error(f"Chat error: {e}, falling back")
            return await self.direct_chat(message, conversation_history, system_prompt)
    
    async def rag_chat(
        self,
        message: str,
        vector_store: PineconeVectorStore,
        system_prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """RAG chat using vector store retriever directly"""
        try:
            # Create retriever
            retriever = vector_store.as_retriever(search_kwargs={"k": 4})
            
            # Get relevant documents
            docs = retriever.invoke(message)
            
            # Format context from documents
            context = "\n\n".join([doc.page_content for doc in docs])
            
            # Create prompt
            prompt_text = system_prompt or SPARK_PERSONALITY
            prompt_text += f"\n\nContext:\n{context}\n\nQuestion: {message}\n\nAnswer:"
            
            # Invoke LLM
            response = self.llm.invoke([HumanMessage(content=prompt_text)])
            
            # Format sources
            sources = [
                {"content": doc.page_content[:200] + "...", "metadata": doc.metadata}
                for doc in docs
            ]
            
            return {
                "answer": response.content.strip(),
                "sources": sources,
                "mode": "rag"
            }
        except Exception as e:
            logger.error(f"RAG error: {e}")
            raise
    
    async def direct_chat(
        self,
        message: str,
        conversation_history: List[Dict[str, str]] = None,
        system_prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """Direct LLM chat"""
        prompt = system_prompt or SPARK_PERSONALITY
        messages = [SystemMessage(content=prompt)]
        
        if conversation_history:
            for msg in conversation_history:
                if msg["role"] == "user":
                    messages.append(HumanMessage(content=msg["content"]))
                elif msg["role"] == "assistant":
                    messages.append(AIMessage(content=msg["content"]))
        
        messages.append(HumanMessage(content=message))
        response = self.llm.invoke(messages)
        
        return {"answer": response.content.strip(), "sources": [], "mode": "direct"}
    
    def load_vector_store(self, collection_name: str):
        """Load vector store (Pinecone)"""
        try:
            # Connect to existing index
            store = PineconeVectorStore(
                index_name=self.index_name,
                embedding=self.embeddings,
                namespace=collection_name # Use 'collection_name' as namespace for separation
            )
            return store
        except Exception as e:
            logger.error(f"Load error: {e}")
            return None
    
    async def upsert_documents(self, documents, collection_name):
        """Upsert documents to Pinecone namespace"""
        try:
            logger.info(f"upsert_documents: namespace={collection_name} docs={len(documents)}")
            
            # PineconeVectorStore class methods are sync/async handled by langchain wrapper
            # Use 'from_documents' to add to existing index
            docsearch = PineconeVectorStore.from_documents(
                documents=documents,
                embedding=self.embeddings,
                index_name=self.index_name,
                namespace=collection_name
            )
            
            logger.info(f"✅ Upserted {len(documents)} documents to Pinecone namespace {collection_name}")
            return docsearch
        except Exception as e:
            logger.error(f"upsert_documents error: {e}")
            raise
    
    def split_documents(self, documents):
        """Split documents"""
        return self.text_splitter.split_documents(documents)

    def _extract_mermaid(self, text: str) -> str:
        # ...existing helper...
        if "```mermaid" in text:
            return text.split("```mermaid",1)[1].split("```",1)[0].strip()
        # ...existing fallback...
        return text.strip()

    async def generate_mermaid_mindmap(
        self,
        topic: str,
        depth: int = 3,
        diagram_type: str = "mindmap",
        custom_prompt: Optional[str] = None
    ) -> str:
        """
        Generate a detailed Mermaid diagram (mindmap or other) for a given topic.
        Returns raw Mermaid code (no markdown fencing).
        """
        try:
            # Strong system prompt to enforce only Mermaid output
            sys = custom_prompt or (
                "You are Spark, an expert educational assistant. "
                "Generate a detailed hierarchical Mermaid diagram for the given topic. "
                "You MUST return ONLY valid Mermaid source code (no markdown, no explanations). "
                "Use the 'mindmap' style when diagram_type=='mindmap'. "
                f"Limit hierarchy depth to {depth}. "
                "Include clear node labels and groupings to reflect deep analysis of the topic."
            )

            user_prompt = f"Create a {diagram_type} about: {topic}\nDepth: {depth}\nReturn ONLY valid Mermaid syntax."

            # Compose messages and call LLM
            messages = [HumanMessage(content=f"{sys}\n\n{user_prompt}")]
            response = self.llm.invoke(messages)

            mermaid_text = self._extract_mermaid(response.content)
            # Small sanitization
            mermaid_text = mermaid_text.strip()
            # Ensure leading mermaid keyword for mindmap / graph
            if diagram_type == "mindmap" and not mermaid_text.lstrip().startswith("mindmap"):
                # Try to wrap if model returned graph syntax
                # prefer returned content but enforce mindmap header if missing
                mermaid_text = "mindmap\n" + mermaid_text

            return mermaid_text

        except Exception as e:
            logger.error(f"Mermaid generation error: {e}")
            # Fallback: return a minimal mindmap
            fallback = (
                "mindmap\n"
                "  root((Topic))\n"
                "    {topic}\n"
                "      Key_A\n"
                "      Key_B\n"
            )
            return fallback

    def _convert_to_safe_mindmap(self, raw: str, topic: str, context: str = "", depth: int = 3) -> str:
        """
        Best-effort conversion of flowchart/graph-like mermaid into a simple, safe mindmap.
        Builds a student-oriented mindmap with sections:
          Overview, Key Concepts, Examples, Exercises, References
        """
        # Extract bracketed labels and quoted labels as candidate nodes
        labels = []
        for m in re.findall(r'\[([^\]]+)\]', raw):
            labels.append(m.strip())
        for m in re.findall(r'["\']([^"\']{3,200})["\']', raw):
            labels.append(m.strip())
        # Extract "Exercise" / "Practice" lines
        examples = []
        for line in raw.splitlines():
            l = line.strip()
            if re.search(r'\b(Exercise|Practice|Example)\b', l, re.I):
                examples.append(re.sub(r'^(.*?[:\-–]\s*)?', '', l).strip())
        # Extract references (urls)
        refs = re.findall(r'(https?://[^\s\)\]]+)', raw)
        # Build simple overview: first sentence of context or fallback using topic
        overview = ""
        if context:
            # first sentence
            sent = re.split(r'[.\n]', context.strip())[0]
            overview = sent.strip() if sent else f"A study guide for {topic}."
        else:
            overview = f"A study guide for {topic}."
        # Derive key concepts from labels (unique, short)
        seen = set()
        key_concepts = []
        for lbl in labels:
            clean = re.sub(r'\s+', ' ', lbl).strip()
            if 6 < len(clean) < 120 and clean.lower() not in seen:
                key_concepts.append(clean)
                seen.add(clean.lower())
            if len(key_concepts) >= max(3, depth + 2):
                break
        # If none found, use simple tokenization of topic/context
        if not key_concepts:
            words = re.findall(r'\b[A-Za-z]{4,}\b', (context or topic))
            for w in words:
                if w.lower() not in seen:
                    key_concepts.append(w)
                    seen.add(w.lower())
                if len(key_concepts) >= max(3, depth + 2):
                    break
        # Examples fallback
        if not examples:
            examples = [f"An example applying {topic} to a small problem."]
        # References fallback
        if not refs:
            refs = []
        # Build mindmap lines (indented)
        lines = []
        lines.append("mindmap")
        lines.append(f"  Root(({topic}))")
        lines.append(f"    Overview")
        lines.append(f"      {overview}")
        if key_concepts:
            lines.append(f"    Key Concepts")
            for kc in key_concepts:
                lines.append(f"      {kc}")
        if examples:
            lines.append(f"    Examples")
            for ex in examples[: max(2, depth)]:
                lines.append(f"      {ex}")
        lines.append(f"    Exercises")
        lines.append(f"      Try implementing a small example that uses {topic}.")
        # include extracted exercises if any
        for ex in examples[: max(2, depth)]:
            lines.append(f"      {ex}")
        if refs:
            lines.append(f"    References")
            for i, r in enumerate(refs[:6], start=1):
                lines.append(f'      Ref{i}["{r}"]')
        return "\n".join(lines)

    async def generate_research_mindmap(
        self,
        topic: str,
        depth: int = 3,
        diagram_type: str = "mindmap",
        custom_prompt: Optional[str] = None,
        color_scheme: Optional[str] = "auto",       # <-- new
        student_level: Optional[str] = "beginner"   # <-- new
    ) -> Dict[str, Any] | str:
        """
        Produce mindmap and return either string (legacy) or dict:
        {"mermaid": "<code>", "themeVars": {...}}
        """
        try:
            # Safe retrieval of context (defensive)
            context_text = ""
            sources_meta = []
            try:
                vector_store = self.load_vector_store("default")
                if vector_store:
                    retriever = vector_store.as_retriever(search_kwargs={"k": 6})
                    docs = []
                    # Try common retriever method names defensively
                    if hasattr(retriever, "get_relevant_documents"):
                        docs = retriever.get_relevant_documents(topic)
                    elif hasattr(retriever, "retrieve"):
                        docs = retriever.retrieve(topic)
                    elif callable(retriever):
                        try:
                            docs = retriever(topic)
                        except Exception:
                            docs = []
                    # Normalize docs and build context
                    if docs:
                        parts = []
                        for d in docs:
                            pc = getattr(d, "page_content", None)
                            if pc:
                                parts.append(pc)
                        if parts:
                            context_text = "\n\n---\n\n".join(parts)
                            for d in docs:
                                sn = getattr(d, "page_content", "") or ""
                                sources_meta.append({
                                    "metadata": getattr(d, "metadata", {}) or {},
                                    "snippet": (sn[:300] + "...") if sn else ""
                                })
            except Exception as e:
                logger.warning("Document retrieval failed: %s", e)
                context_text = ""
                sources_meta = []

            # Compose final system prompt (MINDMAP_PROMPT enforces the grammar)
            system_prompt = MINDMAP_PROMPT
            if custom_prompt:
                # keep custom prompt short and prepend to system instructions
                system_prompt = custom_prompt.strip() + "\n\n" + system_prompt

            # incorporate student_level into system prompt
            if student_level:
                system_prompt = (custom_prompt.strip() + "\n\n" if custom_prompt else "") + \
                    (f"Audience: {student_level}. ") + MINDMAP_PROMPT
            else:
                system_prompt = (custom_prompt.strip() + "\n\n" if custom_prompt else "") + MINDMAP_PROMPT

            # Compose user message with topic, depth and optional context snippet
            user_parts = [f"Topic: {topic}", f"Depth: {depth}", f"Diagram type: {diagram_type}"]
            if context_text:
                # include up to first 600 characters of context to help model (still must return ONLY mermaid)
                user_parts.append("Context: " + (context_text[:600] + ("..." if len(context_text) > 600 else "")))
            user_prompt = "\n\n".join(user_parts) + "\n\nGenerate the Mermaid mindmap now."

            # Use SystemMessage + HumanMessage to call LLM
            from langchain_core.messages import SystemMessage, HumanMessage
            messages = [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]

            response = self.llm.invoke(messages)
            mermaid_text = self._extract_mermaid(response.content or "")

            # Basic sanitization (remove dangerous tokens)
            mermaid_text = re.sub(r'[\[\]\{\}]', '', mermaid_text)
            mermaid_text = mermaid_text.strip()
            if diagram_type == "mindmap" and not mermaid_text.lstrip().startswith("mindmap"):
                mermaid_text = "mindmap\n" + mermaid_text

            # if model produced flowchart-like constructs, convert to safe mindmap (existing helper)
            if diagram_type == "mindmap" and re.search(r'-->|subgraph|graph\b|\[.*\]|->', mermaid_text, re.I):
                try:
                    mermaid_text = self._convert_to_safe_mindmap(mermaid_text, topic, context_text, depth)
                except Exception:
                    pass

            try:
                mermaid_text = self._sanitize_mermaid_labels(mermaid_text)
            except Exception:
                pass

            # Build themeVars mapping based on color_scheme
            color = (color_scheme or "auto").lower()
            theme_vars = {}
            if color == "dark":
                theme_vars = {"primaryTextColor": "#e6edf3", "lineColor": "#e6edf3", "background":"#0b1220"}
            elif color == "light":
                theme_vars = {"primaryTextColor": "#0f1724", "lineColor": "#0f1724", "background":"#ffffff"}
            elif color == "ocean":
                theme_vars = {"primaryTextColor": "#e6f6ff", "lineColor": "#7dd3fc", "background":"#082032"}
            elif color == "sunset":
                theme_vars = {"primaryTextColor": "#2b0707", "lineColor": "#ff7a59", "background":"#fff7f0"}
            else:
                # auto: choose based on student_level (simple heuristic)
                if student_level == "beginner":
                    theme_vars = {"primaryTextColor": "#0f1724", "lineColor": "#0f1724", "background":"#ffffff"}
                else:
                    theme_vars = {"primaryTextColor": "#e6edf3", "lineColor": "#e6edf3", "background":"#0b1220"}

            # return dict with both mermaid and themeVars
            return {"mermaid": mermaid_text, "themeVars": theme_vars}

        except Exception as e:
            logger.error("Mermaid research generation error: %s", e)
            # fallback simple mindmap
            return (
                "mindmap\n"
                f"  Root(({topic}))\n"
                "    Overview\n"
                "      KeyConcepts\n"
                "      Examples\n"
                "      Exercises\n"
            )

    def _sanitize_mermaid_labels(self, mermaid: str) -> str:
        """
        Ensure Mermaid node identifiers are valid (no spaces/special chars).
        If edges reference labels containing spaces, create safe IDs and node defs.
        """
        lines = [ln.rstrip() for ln in mermaid.splitlines()]
        if not lines:
            return mermaid

        # preserve header line if exists, otherwise add mindmap header fallback
        header_idx = 0
        header = lines[0].strip()
        if not (header.startswith("mindmap") or header.startswith("graph") or header.startswith("flowchart") or header.startswith("graph ")):
            # leave header as-is but ensure a header exists for flowchart style fallback
            # do not force override if user specified another valid header in content
            # we'll not add header here to avoid surprising changes
            pass

        # collect explicit IDs defined via: ID[Label] or ID("Label") or ID(("Label"))
        defined_ids = {}
        node_def_re = re.compile(r'^\s*([A-Za-z0-9_]+)\s*[\(\[]\s*["\']?(.*?)["\']?\s*[\)\]]')
        for ln in lines:
            m = node_def_re.match(ln)
            if m:
                node_id = m.group(1)
                label = m.group(2)
                defined_ids[node_id] = label

        # find edge usages like: A --> B   (tokens possibly containing spaces)
        edge_re = re.compile(r'([A-Za-z0-9_\- ]+)\s*-->\s*([A-Za-z0-9_\- ]+)')
        # mapping of safe id -> label (for nodes to add)
        add_nodes = {}
        # function to create safe id
        def make_id(label: str) -> str:
            s = re.sub(r'\W+', '_', label).strip('_')
            if not s:
                s = "node"
            orig = s
            i = 1
            while s in defined_ids or s in add_nodes:
                s = f"{orig}_{i}"
                i += 1
            return s

        # remap edge references to safe ids
        def remap_edge(match):
            src, dst = match.groups()
            src_id = make_id(src)
            dst_id = make_id(dst)
            # ensure source node is defined
            if src_id not in defined_ids:
                add_nodes[src_id] = src  # keep original label for new node
            return f"{src_id} --> {dst_id}"

        # apply edge remapping
        new_lines = []
        for ln in lines:
            if ln.strip() == "":
                continue  # skip empty lines
            if edge_re.search(ln):
                # line contains an edge, apply remapping
                new_ln = edge_re.sub(remap_edge, ln)
                new_lines.append(new_ln)
            else:
                new_lines.append(ln)

        # append node defs for add_nodes (place near end)
        if add_nodes:
            new_lines.append("")  # spacing
            for nid, lbl in add_nodes.items():
                # create a quoted label to preserve spaces and special chars
                # use flowchart-bracket label syntax
                new_lines.append(f'{nid}["{lbl}"]')

        return "\n".join(new_lines)

    def _sanitize_mindmap_strict(self, mermaid: str, topic: str, depth: int = 3) -> str:
        """
        Enforce strict Mermaid mindmap grammar and clean common LLM artifacts.
        Returns a cleaned mindmap string safe for mermaid.parse().
        """
        if not mermaid:
            return f"mindmap\n  root(({topic}))\n"

        # Split lines and normalize whitespace
        lines = mermaid.splitlines()

        # Remove any leading/trailing empty lines
        while lines and not lines[0].strip():
            lines.pop(0)
        while lines and not lines[-1].strip():
            lines.pop()

        # Ensure header exists
        if not lines or not lines[0].strip().lower().startswith("mindmap"):
            # if first line contains something like 'graph' or 'flowchart', discard and create header
            # keep the rest as content
            lines.insert(0, "mindmap")

        # Ensure second line is root((Title)) — if missing, create one from topic
        if len(lines) < 2 or not re.match(r'^\s*root\s*\(\(.*\)\)\s*$', lines[1], flags=re.I):
            root_label = topic.strip()[:100] or "Topic"
            # sanitize root label characters
            root_label = re.sub(r'[\[\]\{\}]', '', root_label)
            lines.insert(1, f"  root(({root_label}))")

        # Process subsequent lines
        clean_lines = [lines[0], lines[1]]
        # Allowed characters inside labels (keep parentheses, colon, comma, period)
        allowed_re = re.compile(r"[^A-ZaZ0-9 \,\.\:\(\)\?\!\/\+\-%&_@]")
        # Normalize indentation: use 2 spaces per level
        for ln in lines[2:]:
            orig = ln
            # Convert tabs to two spaces
            ln = ln.replace("\t", "  ")
            # Remove leading/trailing spaces
            ln_strip = ln.rstrip()
            leading = len(ln_strip) - len(ln_strip.lstrip(" "))
            content = ln_strip.lstrip(" ")

            # Remove common list markers and markdown bullets at start
            content = re.sub(r'^[-\*\u2022\u2013\u2014]\s+', '', content)
            content = re.sub(r'^\d+[\.\)]\s+', '', content)
            # Remove markdown headers like '# '
            content = re.sub(r'^\s*#{1,6}\s*', '', content)

            # Remove bracket/box syntax leftovers
            content = re.sub(r'[\[\]\{\}]', '', content)

            # Remove inline markdown bullets like '- ' in middle of label
            content = re.sub(r'\s*-\s*', ' - ', content)

            # Collapse multiple spaces
            content = re.sub(r'\s+', ' ', content).strip()

            # Truncate overly long labels
            if len(content) > 120:
                content = content[:117].rstrip() + "..."

            # Remove disallowed characters
            content = allowed_re.sub('', content).strip()

            # If content becomes empty, skip line
            if not content:
                continue

            # Normalize indentation level based on original leading spaces
            # Each level = 2 spaces. Compute level = round(leading / 2).
            level = max(0, int(round(leading / 2)))
            # Cap level by depth (plus 1 for root)
            if level > depth:
                level = depth
            indent = "  " * (level + 1)  # +1 because root is at level 0 occupying second line
            clean_lines.append(f"{indent}{content}")

        # Remove duplicate adjacent lines
        final_lines = []
        prev = None
        for ln in clean_lines:
            if ln.strip() == prev:
                continue
            final_lines.append(ln.rstrip())
            prev = ln.strip()

        return "\n".join(final_lines) + "\n"

    def _normalize_mindmap_output(self, text: str, topic: str, depth: int = 3) -> str:
        """
        Normalize LLM output into a strict Mermaid mindmap:
        - Remove any prefix before the first 'mindmap' token
        - Ensure 'mindmap' is on its own line
        - Ensure a proper root((Title)) as the second line
        - Normalize section headings into their own lines and indent content
        - Delegate to strict sanitizer at the end
        """
        if not text:
            return self._sanitize_mindmap_strict("", topic, depth)

        # 1) Strip everything before first 'mindmap' token
        m = re.search(r'\bmindmap\b', text, flags=re.I)
        if m:
            text = text[m.start():]
        else:
            # no explicit mindmap token: start fresh
            return self._sanitize_mindmap_strict("", topic, depth)

        # 2) Normalize whitespace and ensure 'mindmap' is on its own line
        # Replace sequences like "mindmap root((" or "mindmap  root" into "mindmap\n  root(("
        text = re.sub(r'^\s*mindmap\s*', 'mindmap\n', text, flags=re.I)

        # 3) If root is inline after mindmap, force newline before root
        text = re.sub(r'(?mi)^mindmap\s+root\(', 'mindmap\nroot(', text)

        # 4) Ensure second line is a proper root((Title))
        lines = text.splitlines()
        # trim leading/trailing empties
        lines = [ln.rstrip() for ln in lines if ln.strip() != ""]
        if not lines:
            return self._sanitize_mindmap_strict("", topic, depth)

        # ensure header
        if not lines[0].strip().lower().startswith("mindmap"):
            lines.insert(0, "mindmap")

        # check root line
        if len(lines) < 2 or not re.match(r'^\s*root\s*\(\(.+)\)\s*$', lines[1], flags=re.I):
            # attempt to extract a title from the first line of content or fallback to topic
            title = topic.strip() or "Topic"
            # If there's a candidate after header, use it
            if len(lines) >= 2 and lines[1].strip():
                cand = lines[1].strip()
                # remove disallowed chars
                cand = re.sub(r'[\[\]\{\}]', '', cand)[:100].strip()
                if cand:
                    title = cand
            lines.insert(1, f"  root(({title}))")

        # Rebuild text starting from header + root
        body_lines = lines[:2] + lines[2:]

        # 5) Normalize known headings so they appear on their own line and their following text is indented.
        # Headings to detect (case-insensitive)
        headings = ["Overview", "Key Concepts", "Examples", "Exercises", "Common Pitfalls", "References"]
        joined = "\n".join(body_lines)

        # Ensure headings are separated: "Overview Some text" -> "Overview\n  Some text"
        for h in headings:
            # insert newline after heading if followed by text on same line
            joined = re.sub(rf'(?mi)(\b{re.escape(h)}\b)\s*[:\-–]?\s+', rf'\1\n    ', joined)

            # if heading occurs without indentation, ensure it's indented at level 1 (two spaces)
            joined = re.sub(rf'(?m)^[ \t]*(?:{re.escape(h)})\s*$', rf'  {h}', joined)

        # 6) Replace stray inline separators or bullets that break parser (e.g., " - ", "•", numbered lists)
        joined = re.sub(r'^[ \t]*[-\u2022]\s*', '    ', joined, flags=re.M)  # convert bullets to indented text
        joined = re.sub(r'(?m)^\s*\d+[\.\)]\s*', '    ', joined)  # numbered lists

        # 7) Remove any stray bracket/box syntax left
        joined = re.sub(r'[\[\]\{\}]', '', joined)

        # 8) Collapse multiple consecutive blank lines to one
        joined = re.sub(r'\n{3,}', '\n\n', joined)

        # 9) Pass through final strict sanitizer to guarantee compliance
        final = self._sanitize_mindmap_strict(joined, topic, depth)
        return final

    def _strip_to_first_mindmap(self, text: str) -> str:
        """Remove any text before first 'mindmap' token (case-insensitive)."""
        if not text:
            return text
        m = re.search(r'\bmindmap\b', text, flags=re.I)
        if not m:
            return text
        return text[m.start():].lstrip()

    def _is_mindmap_valid(self, text: str, max_depth: int = 6) -> bool:
        """
        Simple strict validator for Mermaid mindmap:
        - first non-empty line == 'mindmap'
        - second non-empty line matches: two-space indent + root((...))
        - all subsequent lines: indentation is multiple of 2 spaces and label length <= 120
        - forbidden tokens not present: --> , -> , [], {}, subgraph, graph, flowchart
        """
        if not text:
            return False
        # remove leading/trailing blank lines
        lines = [ln.rstrip() for ln in text.splitlines() if ln.strip() != ""]
        if len(lines) < 2:
            return False
        if not re.match(r'^\s*mindmap\s*$', lines[0], flags=re.I):
            return False
        if not re.match(r'^\s{2}root\s*\(\(.{1,120}\)\)\s*$', lines[1], flags=re.I):
            return False
        for ln in lines[2:]:
            # check forbidden tokens
            if re.search(r'-->|->|\[.*\]|\{|\}|subgraph\b|graph\b|flowchart\b', ln, flags=re.I):
                return False
            # leading spaces must be multiple of 2
            leading = len(ln) - len(ln.lstrip(" "))
            if leading % 2 != 0:
                return False
            # label length after trimming should be <=120
            label = ln.strip()
            if len(label) > 120:
                return False
        # depth check
        max_seen_depth = 0
        for ln in lines[2:]:
            level = (len(ln) - len(ln.lstrip(" "))) // 2
            if level > max_seen_depth:
                max_seen_depth = level
        if max_seen_depth > max_depth:
            return False
        return True

    # Strict regeneration system prompt used on retries
    _REGEN_PROMPT = (
        "IMPORTANT: You MUST return ONLY a valid Mermaid mindmap source, nothing else. "
        "Do NOT output any explanation, commentary, or markdown fences. "
        "Output MUST follow the exact mindmap grammar: first line 'mindmap', second line two-space indented "
        "root((Title)), subsequent lines two-space indentation per level, NO arrows, NO brackets, NO subgraph. "
        "Keep labels <= 120 characters. Limit depth to the requested value. Return only the diagram."
        "Make sure that whatever you output can be parsed by Mermaid without errors."
    )

    async def generate_research_mindmap(
        self,
        topic: str,
        depth: int = 3,
        diagram_type: str = "mindmap",
        custom_prompt: Optional[str] = None,
        color_scheme: Optional[str] = "auto",
        student_level: Optional[str] = "beginner"
    ) -> Dict[str, Any]:
        """
        Generate a Mermaid diagram and return dict with mermaidCode and themeVars.
        Always returns: {"mermaidCode": str, "themeVars": dict}
        """
        try:
            # Retrieval logic (optional)
            context_text = ""
            try:
                vector_store = self.load_vector_store("default")
                if vector_store:
                    retriever = vector_store.as_retriever(search_kwargs={"k": 4})
                    docs = retriever.invoke(topic) if hasattr(retriever, "invoke") else []
                    if docs:
                        context_text = "\n\n".join([getattr(d, "page_content", "") for d in docs if hasattr(d, "page_content")])
            except Exception as e:
                logger.warning(f"Retrieval skipped: {e}")
            
            # Build system prompt
            base_prompt = MINDMAP_PROMPT if diagram_type == "mindmap" else (
                "Generate ONLY valid Mermaid source code (no fences, no commentary). "
                f"Create a {diagram_type} diagram for the given topic. "
                "Use proper Mermaid syntax with correct indentation."
            )
            
            system_prompt = f"Audience: {student_level}.\n\n{base_prompt}"
            if custom_prompt:
                system_prompt = custom_prompt.strip() + "\n\n" + system_prompt
            
            # Build user prompt
            user_prompt = f"Topic: {topic}\nDepth: {depth}\nDiagram type: {diagram_type}\n"
            if context_text:
                user_prompt += f"Context: {context_text[:400]}...\n"
            user_prompt += "Generate the diagram now."
            
            # Call LLM
            messages = [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]
            response = self.llm.invoke(messages)
            
            # Extract mermaid code
            mermaid_text = self._extract_mermaid(response.content or "")
            mermaid_text = mermaid_text.strip()
            
            # Sanitize and validate for mindmap only
            if diagram_type == "mindmap":
                # Strip prefix commentary
                mermaid_text = self._strip_to_first_mindmap(mermaid_text)
                # Remove forbidden tokens
                mermaid_text = re.sub(r'[\[\]\{\}]', '', mermaid_text)
                mermaid_text = re.sub(r'--?>.*', '', mermaid_text)
                
                # Ensure header
                if not mermaid_text.lstrip().startswith("mindmap"):
                    mermaid_text = "mindmap\n" + mermaid_text
                
                # Validate and retry if needed
                RETRY_MAX = 1
                attempt = 0
                while attempt <= RETRY_MAX:
                    if self._is_mindmap_valid(mermaid_text, max_depth=depth):
                        try:
                            mermaid_text = self._sanitize_mindmap_strict(mermaid_text, topic, depth)
                        except:
                            pass
                        break
                    
                    # Retry with strict prompt
                    attempt += 1
                    try:
                        reg_system = self._REGEN_PROMPT
                        reg_messages = [
                            SystemMessage(content=reg_system),
                            HumanMessage(content=f"Topic: {topic}\nDepth: {depth}\nGenerate mindmap.")
                        ]
                        reg_response = self.llm.invoke(reg_messages)
                        mermaid_text = self._strip_to_first_mindmap(reg_response.content or "")
                        mermaid_text = re.sub(r'[\[\]\{\}]', '', mermaid_text)
                    except Exception as e:
                        logger.warning(f"Retry failed: {e}")
                        break
                
                # Final fallback
                if not self._is_mindmap_valid(mermaid_text, max_depth=depth):
                    logger.warning(f"Using fallback for {topic}")
                    mermaid_text = (
                        f"mindmap\n  root(({topic}))\n"
                        "    Overview\n      Key points\n"
                        "    Key Concepts\n      Concept A\n      Concept B\n"
                        "    Examples\n      Example 1\n"
                    )
            else:
                # For other diagram types, basic cleanup
                mermaid_text = re.sub(r'[\[\]\{\}]', '', mermaid_text)
            
            # Build theme vars
            theme_vars = self._get_theme_vars(color_scheme, student_level)
            
            return {
                "mermaidCode": mermaid_text,
                "themeVars": theme_vars
            }
            
        except Exception as e:
            logger.error(f"Mindmap generation failed: {e}")
            import traceback
            traceback.print_exc()
            # Return safe fallback
            return {
                "mermaidCode": f"mindmap\n  root(({topic}))\n    Error\n      Generation failed\n",
                "themeVars": {}
            }
    
    async def generate_quiz(
        self,
        topic: str,
        num_questions: int = 5,
        difficulty: str = "medium",
        custom_prompt: Optional[str] = None,
        collection_name: str = "default"
    ) -> List[Dict[str, Any]]:
        """
        Generate a quiz from a topic (RAG enabled).
        Returns list of question objects.
        """
        try:
            # Retrieval logic
            context_text = ""
            try:
                vector_store = self.load_vector_store(collection_name)
                if vector_store:
                    retriever = vector_store.as_retriever(search_kwargs={"k": 6})
                    docs = retriever.invoke(topic)
                    if docs:
                        context_text = "\n\n".join([doc.page_content for doc in docs])
            except Exception as e:
                logger.warning(f"Quiz retrieval skipped: {e}")

            system_prompt = (
                "You are an expert educator. Create a high-quality quiz based on the topic and context provided.\n"
                f"Difficulty: {difficulty}\n"
                "Output ONLY a JSON array of question objects.\n"
                "Each object must have: 'question', 'options' (array of 4 strings), 'correctAnswer' (0-3 index), 'explanation'.\n"
                "Format: [{\"question\": \"...\", \"options\": [\"...\", \"...\", \"...\", \"...\"], \"correctAnswer\": 0, \"explanation\": \"...\"}, ...]"
            )
            if custom_prompt:
                system_prompt = custom_prompt.strip() + "\n\n" + system_prompt

            user_prompt = f"Topic: {topic}\nNumber of questions: {num_questions}\n"
            if context_text:
                user_prompt += f"Context: {context_text[:1200]}\n"
            user_prompt += "Generate the JSON quiz now."

            messages = [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]
            response = self.llm.invoke(messages)
            
            # Extract JSON
            json_str = response.content.strip()
            if "```json" in json_str:
                json_str = json_str.split("```json")[1].split("```")[0].strip()
            elif "```" in json_str:
                json_str = json_str.split("```")[1].split("```")[0].strip()
            
            questions = json.loads(json_str)
            return questions

        except Exception as e:
            logger.error(f"Quiz generation failed: {e}")
            return []

    async def generate_flashcards(
        self,
        topic: str,
        count: int = 10,
        custom_prompt: Optional[str] = None,
        collection_name: str = "default"
    ) -> List[Dict[str, Any]]:
        """
        Generate flashcards from a topic (RAG enabled).
        Returns list of flashcard objects: {"front": "...", "back": "..."}
        """
        try:
            # Retrieval logic
            context_text = ""
            try:
                vector_store = self.load_vector_store(collection_name)
                if vector_store:
                    retriever = vector_store.as_retriever(search_kwargs={"k": 6})
                    docs = retriever.invoke(topic)
                    if docs:
                        context_text = "\n\n".join([doc.page_content for doc in docs])
            except Exception as e:
                logger.warning(f"Flashcard retrieval skipped: {e}")

            system_prompt = (
                "You are an expert study assistant. Create effective flashcards for active recall.\n"
                "Output ONLY a JSON array of flashcard objects.\n"
                "Each object must have: 'front' (the question/term) and 'back' (the answer/explanation).\n"
                "Format: [{\"front\": \"...\", \"back\": \"...\"}, ...]"
            )
            if custom_prompt:
                system_prompt = custom_prompt.strip() + "\n\n" + system_prompt

            user_prompt = f"Topic: {topic}\nNumber of cards: {count}\n"
            if context_text:
                user_prompt += f"Context: {context_text[:1200]}\n"
            user_prompt += "Generate the JSON flashcards now."

            messages = [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]
            response = self.llm.invoke(messages)
            
            # Extract JSON
            json_str = response.content.strip()
            if "```json" in json_str:
                json_str = json_str.split("```json")[1].split("```")[0].strip()
            elif "```" in json_str:
                json_str = json_str.split("```")[1].split("```")[0].strip()
            
            cards = json.loads(json_str)
            return cards

        except Exception as e:
            logger.error(f"Flashcard generation failed: {e}")
            return []

    def _get_theme_vars(self, color_scheme: str, student_level: str) -> Dict[str, str]:
        """Get theme variables based on color scheme"""
        color = (color_scheme or "auto").lower()
        
        if color == "dark":
            return {"primaryTextColor": "#e6edf3", "lineColor": "#e6edf3", "background": "#0b1220"}
        elif color == "light":
            return {"primaryTextColor": "#0f1724", "lineColor": "#0f1724", "background": "#ffffff"}
        elif color == "ocean":
            return {"primaryTextColor": "#e6f6ff", "lineColor": "#7dd3fc", "background": "#082032"}
        elif color == "sunset":
            return {"primaryTextColor": "#2b0707", "lineColor": "#ff7a59", "background": "#fff7f0"}
        else:
            # Auto based on student level
            if student_level == "beginner":
                return {"primaryTextColor": "#0f1724", "lineColor": "#0f1724", "background": "#ffffff"}
            else:
                return {"primaryTextColor": "#e6edf3", "lineColor": "#e6edf3", "background": "#0b1220"}

# Create singleton
logger.info("=" * 80)
logger.info("🏗️  CREATING LANGCHAIN SERVICE SINGLETON")
logger.info("=" * 80)

langchain_service = None

try:
    langchain_service = LangChainService()
    logger.info("✅ SINGLETON CREATED SUCCESSFULLY: %s", langchain_service)
except Exception as e:
    logger.exception("❌ SINGLETON CREATION FAILED: %s", e)
    langchain_service = None

logger.debug("🔍 Final langchain_service: %s", langchain_service)
