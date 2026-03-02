"""
Robust Mindmap & Diagram Service (Groq-compatible)

Features:
- topic normalization + diagram-type detection
- optional short research to improve labels
- strict Mermaid-only generation prompt
- validation & one automatic repair attempt
- raises on final failure (no silent fallbacks)
"""

import json
import re
import logging
from typing import Optional, Dict

from app.core.llm import generate_response

logger = logging.getLogger(__name__)

DIAGRAM_TYPES = {
    "mindmap": "mindmap",
    "flowchart": "flowchart TD",
    "sequence": "sequenceDiagram",
    "class": "classDiagram",
    "er": "erDiagram",
    "state": "stateDiagram-v2",
}

# Gold standard examples for each diagram type
GOLD_STANDARD_EXAMPLES = {
    "mindmap": """mindmap
  root((AI Ethics))
    Principles
      Fairness
      Transparency
      Accountability
    Applications
      Healthcare
      Criminal Justice
      Hiring
    Challenges
      Bias in Data
      Privacy Concerns
      Explainability""",

    "flowchart": """flowchart TD
    A[Start] --> B{Is it raining?}
    B -->|Yes| C[Take umbrella]
    B -->|No| D[Enjoy sunshine]
    C --> E[Go outside]
    D --> E
    E --> F[End]""",

    "sequence": """sequenceDiagram
    participant User
    participant AuthService
    participant Database
    
    User->>AuthService: Login Request
    AuthService->>Database: Validate Credentials
    Database-->>AuthService: User Record
    AuthService-->>User: JWT Token
    User->>AuthService: API Request with JWT
    AuthService-->>User: Data Response""",

    "class": """classDiagram
    class BankAccount {
        -String accountNumber
        -Double balance
        +deposit(amount Double)
        +withdraw(amount Double) Boolean
        +getBalance() Double
    }
    
    class SavingsAccount {
        -Double interestRate
        +applyInterest()
    }
    
    class CheckingAccount {
        -Double overdraftLimit
        +processCheck()
    }
    
    BankAccount <|-- SavingsAccount
    BankAccount <|-- CheckingAccount""",

    "er": """erDiagram
    CUSTOMER {
        int customer_id PK
        string first_name
        string last_name
        string email
        date created_at
    }
    
    ORDER {
        int order_id PK
        int customer_id FK
        decimal total_amount
        date order_date
        string status
    }
    
    PRODUCT {
        int product_id PK
        string name
        decimal price
        int stock_quantity
    }
    
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ ORDER_ITEM : contains
    PRODUCT ||--o{ ORDER_ITEM : includes""",

    "state": """stateDiagram-v2
    [*] --> Idle
    Idle --> Loading : fetchData
    Loading --> Success : dataReceived
    Loading --> Error : timeout
    Error --> Loading : retry
    Success --> [*] : complete
    Success --> Loading : refresh"""
}

# helper regexes
_CODE_FENCE_RE = re.compile(r"```(?:[\s\S]*?)```", re.DOTALL)
_JSON_RE = re.compile(r"\{[\s\S]*\}", re.DOTALL)


class MindmapService:
    async def generate(
        self,
        topic: str,
        diagram_type: Optional[str] = None,
        detail_level: int = 3,
        research: bool = True,
        custom_prompt: Optional[str] = None,
    ) -> str:
        """
        Top-level method used by the FastAPI route.
        Raises Exception on failure.
        """

        if not topic or not topic.strip():
            raise ValueError("Topic must be a non-empty string")

        # 1) Normalize: fix spelling, extract canonical topic & target diagram type
        normalized = await self._normalize_topic_and_type(topic, diagram_type)
        canonical_topic = normalized["topic"]
        diagram_key = normalized["diagram_type"]  # one of DIAGRAM_TYPES keys
        mermaid_keyword = DIAGRAM_TYPES[diagram_key]

        # 2) Optional research to improve node labels
        research_text = ""
        if research:
            try:
                research_text = await self._short_research(canonical_topic)
            except Exception as e:
                logger.debug("Research step failed: %s", e)
                research_text = ""

        # 3) Generate strict Mermaid code
        mermaid = await self._generate_strict_mermaid(
            canonical_topic,
            mermaid_keyword,
            detail_level,
            research_text,
            custom_prompt,
        )

        # 4) Validate
        if self._is_valid(mermaid, mermaid_keyword, detail_level):
            return mermaid

        # 5) Attempt one repair / regeneration
        logger.warning("Mermaid invalid on first attempt; trying repair/regenerate.")
        repaired = await self._repair_mermaid(
            mermaid or "", canonical_topic, mermaid_keyword, detail_level, custom_prompt
        )

        if self._is_valid(repaired, mermaid_keyword, detail_level):
            return repaired

        # 6) Final failure
        logger.error("Failed to produce valid Mermaid after retry. Raw outputs: first=%r repaired=%r", mermaid, repaired)
        raise RuntimeError("Could not generate a valid Mermaid diagram (see server logs).")

    # ---------------------------------------------------------------------
    # Normalization: correct topic string and detect desired diagram type
    # ---------------------------------------------------------------------
    async def _normalize_topic_and_type(self, raw_topic: str, requested_type: Optional[str]) -> Dict[str, str]:
        """
        Uses the LLM to:
          - correct spelling / normalize topic to Title Case
          - detect or confirm diagram type (mindmap|flowchart|sequence|class|er|state)
        Returns: {"topic": "Investment Banking", "diagram_type": "mindmap"}
        """
        # if the frontend already provided a plausible explicit type, prefer it (but still canonicalize)
        requested_type_hint = (requested_type or "").strip().lower()

        prompt = f"""
You are a small utility that receives noisy user input and returns a JSON object with:
- corrected "topic" (short title, Title Case),
- canonical "diagram_type" (one of: mindmap, flowchart, sequence, class, er, state).

User input: \"{raw_topic}\"
Requested type hint: \"{requested_type_hint}\"

Rules:
- Correct spelling mistakes.
- If the user explicitly requested a diagram type (words like "mindmap", "flowchart", "er diagram", "sequence", "class diagram", "state diagram"), honor that.
- Otherwise pick the most appropriate diagram type for the topic.
- Output ONLY valid JSON like:
{{"topic": "Investment Banking", "diagram_type": "mindmap"}}
"""

        raw = await generate_response(prompt, system_prompt="You are a concise JSON-only normalizer.")
        # extract JSON substring
        m = _JSON_RE.search(raw)
        if not m:
            # last resort: try simple heuristics locally
            topic_clean = self._clean_label(raw_topic)
            dtype = self._infer_type_from_hint(requested_type_hint, raw_topic)
            return {"topic": topic_clean, "diagram_type": dtype}

        try:
            parsed = json.loads(m.group(0))
            topic_out = parsed.get("topic", "").strip()
            dtype = parsed.get("diagram_type", "").strip().lower()
            if not topic_out:
                topic_out = self._clean_label(raw_topic)
            if dtype not in DIAGRAM_TYPES:
                dtype = self._infer_type_from_hint(requested_type_hint, raw_topic)
            return {"topic": topic_out, "diagram_type": dtype}
        except Exception:
            topic_clean = self._clean_label(raw_topic)
            dtype = self._infer_type_from_hint(requested_type_hint, raw_topic)
            return {"topic": topic_clean, "diagram_type": dtype}

    def _infer_type_from_hint(self, hint: str, raw_topic: str) -> str:
        # small deterministic heuristics
        if hint in DIAGRAM_TYPES:
            return hint
        lowered = raw_topic.lower()
        if "flow" in lowered or "process" in lowered or "workflow" in lowered:
            return "flowchart"
        if "sequence" in lowered or "timeline" in lowered or "interaction" in lowered:
            return "sequence"
        if "class" in lowered or "uml" in lowered:
            return "class"
        if "er" in lowered or "entity" in lowered or "schema" in lowered or "database" in lowered:
            return "er"
        if "state" in lowered or "state machine" in lowered:
            return "state"
        # default
        return "mindmap"

    # ---------------------------------------------------------------------
    # Optional short research to help LLM pick labels (4 short facts)
    # ---------------------------------------------------------------------
    async def _short_research(self, topic: str) -> str:
        prompt = f"Provide 4 very short factual bullets (one line each) about: {topic}. No explanations."
        out = await generate_response(prompt, system_prompt="Provide 4 short factual bullets only.")
        # strip code fences and return up to ~600 chars
        out = _CODE_FENCE_RE.sub("", out).strip()
        return out[:800]

    # ---------------------------------------------------------------------
    # Core generation: strict Mermaid-only prompt
    # ---------------------------------------------------------------------
    async def _generate_strict_mermaid(
        self,
        topic: str,
        mermaid_keyword: str,
        detail_level: int,
        research_text: str,
        custom_prompt: Optional[str],
    ) -> str:
        """
        Ask the LLM to output STRICT Mermaid code. We pass a very prescriptive system prompt,
        and a detailed user prompt including gold standard examples for each diagram type.
        """
        detail_map = {
            1: "5-7 nodes, 2 levels",
            2: "7-10 nodes, 2-3 levels",
            3: "12-18 nodes, 3-4 levels",
            4: "18-25 nodes, 4-5 levels",
            5: "25-35 nodes, 5-6 levels",
        }
        detail_desc = detail_map.get(detail_level, "12-18 nodes, 3-4 levels")

        # small deterministic safe topic label
        safe_topic = self._clean_label(topic)

        # Get gold standard example for this diagram type
        diagram_key = next(k for k, v in DIAGRAM_TYPES.items() if v == mermaid_keyword)
        gold_example = GOLD_STANDARD_EXAMPLES[diagram_key]

        user_prompt = f"""
Generate STRICT Mermaid code only. DO NOT output markdown fences, commentary, or any text outside the Mermaid code block.

Constraints:
- First line MUST be exactly: {mermaid_keyword}
- Labels: 1-4 words, no HTML, no special characters (only letters, numbers, spaces, hyphens)
- Follow the structure and style of the gold standard example below
- Ensure proper syntax for {mermaid_keyword} diagram type

Topic: {topic}
SafeTopicLabel: {safe_topic}
Detail: {detail_desc}
ResearchContext (do NOT output directly; use only to inform node labels):
{research_text}

{custom_prompt or ""}

Gold Standard Example (follow this structure and quality):
{gold_example}

Now output the Mermaid diagram for the topic. Begin with the {mermaid_keyword} line and nothing else.
"""

        raw = await generate_response(user_prompt, system_prompt="You are strict: output only valid mermaid code.")
        return self._extract_mermaid(raw, mermaid_keyword, safe_topic)

    # ---------------------------------------------------------------------
    # Extraction: remove fences and return the Mermaid region starting with the keyword
    # ---------------------------------------------------------------------
    def _extract_mermaid(self, raw: str, mermaid_keyword: str, safe_topic: str) -> str:
        if not raw:
            return ""

        # remove fenced code blocks
        cleaned = _CODE_FENCE_RE.sub("", raw).strip()
        # strip any internal <think>...</think> blocks that may have leaked through
        cleaned = re.sub(r"<think>[\s\S]*?<\/think>", "", cleaned, flags=re.IGNORECASE).strip()

        # look for the first line that starts with the mermaid keyword
        lines = [l.rstrip() for l in cleaned.splitlines()]
        idx = None
        for i, line in enumerate(lines):
            if line.strip().lower().startswith(mermaid_keyword.lower()):
                idx = i
                break

        if idx is None:
            # fallback: return cleaned and let validation reject it
            return cleaned

        candidate_lines = lines[idx:]
        candidate = "\n".join(candidate_lines).strip()

        # If the first line contains extra words (e.g. 'mindmap about X'), replace it
        first = candidate_lines[0].strip()
        if first.lower() != mermaid_keyword.lower():
            candidate_lines[0] = mermaid_keyword
            candidate = "\n".join(candidate_lines).strip()

        # For mindmaps, apply stricter postprocessing to guarantee valid syntax and node count
        if mermaid_keyword.lower() == "mindmap":
            try:
                candidate = self._postprocess_mermaid(candidate, safe_topic)
            except Exception as e:
                logger.debug("Postprocess failed: %s", e)

        return candidate

    # ---------------------------------------------------------------------
    # Repair: send the raw mermaid attempt back to LLM with strict "fix" instruction
    # ---------------------------------------------------------------------
    async def _repair_mermaid(
        self,
        raw_candidate: str,
        topic: str,
        mermaid_keyword: str,
        detail_level: int,
        custom_prompt: Optional[str],
    ) -> str:
        # If raw_candidate is empty, regenerate from scratch
        if not raw_candidate.strip():
            logger.debug("Repair invoked but initial raw candidate empty — regenerating from scratch.")
            return await self._generate_strict_mermaid(topic, mermaid_keyword, detail_level, "", custom_prompt)

        prompt = f"""
The Mermaid diagram below may be invalid. RETURN ONLY corrected Mermaid code.
- DO NOT include markdown fences or any commentary.
- Ensure the diagram starts with exactly: {mermaid_keyword}
- Fix syntax errors, balance brackets/parentheses, ensure indentation for mindmap.

ORIGINAL:
{raw_candidate}

Return the corrected Mermaid code only.
"""
        out = await generate_response(prompt, system_prompt="Fix Mermaid code and output only the corrected code.")
        return self._extract_mermaid(out, mermaid_keyword, self._clean_label(topic))

    # ---------------------------------------------------------------------
    # Validation: diagram-specific checks
    # ---------------------------------------------------------------------
    def _is_valid(self, code: str, mermaid_keyword: str, detail_level: int) -> bool:
        if not code or not code.strip():
            return False
        lines = [l.rstrip() for l in code.splitlines() if l.strip()]

        if not lines:
            return False
        # first line must match keyword
        if lines[0].strip() != mermaid_keyword:
            logger.debug("Validation failed: first line not keyword (%r != %r)", lines[0].strip(), mermaid_keyword)
            return False

        # general no-HTML check
        if re.search(r"<\/?\w+>", code):
            logger.debug("Validation failed: HTML-like tags found")
            return False

        # must have at least 2 non-empty lines
        if len(lines) < 2:
            logger.debug("Validation failed: too few lines")
            return False

        body = "\n".join(lines[1:])

        # diagram-specific heuristics
        if mermaid_keyword == "mindmap":
            # root should exist
            if not re.search(r"root\(\(", body, flags=re.IGNORECASE):
                logger.debug("Validation failed: mindmap missing root")
                return False
            # basic indentation sanity: at least one child with indentation
            if not re.search(r"^\s{2,}\S", body, flags=re.MULTILINE):
                logger.debug("Validation failed: mindmap missing indented nodes")
                return False
            return True

        if mermaid_keyword.startswith("flowchart"):
            if not re.search(r"-->|->", body):
                logger.debug("Validation failed: flowchart missing arrows")
                return False
            return True

        if mermaid_keyword == "sequenceDiagram":
            if not re.search(r"participant\s+\w+", body):
                logger.debug("Validation failed: sequence missing participants")
                return False
            if not re.search(r"-->|->>|-->>", body):
                # sequence uses ->> and -->> patterns
                # accept single arrow too
                logger.debug("Validation failed: sequence missing message arrows")
                return False
            return True

        if mermaid_keyword == "classDiagram":
            if not re.search(r"class\s+\w+", body):
                logger.debug("Validation failed: classDiagram missing class")
                return False
            return True

        if mermaid_keyword == "erDiagram":
            if not re.search(r"\b[A-Z0-9_]+\s*\{", body):
                # look for entity blocks like NAME {
                logger.debug("Validation failed: erDiagram missing entity block")
                return False
            return True

        if mermaid_keyword == "stateDiagram-v2":
            if not re.search(r"-->|--\>|->", body):
                logger.debug("Validation failed: state diagram missing transitions")
                return False
            return True

        # default accept if first line matched and there are content lines
        return True

    # ---------------------------------------------------------------------
    # Utilities
    # ---------------------------------------------------------------------
    def _clean_label(self, s: str) -> str:
        s = (s or "").strip()
        s = re.sub(r"[^A-Za-z0-9\s\-]", " ", s)
        parts = [p for p in s.split() if p]
        return " ".join(p.capitalize() for p in parts[:4]) or "Topic"

    def _postprocess_mermaid(self, candidate: str, safe_topic: str) -> str:
        """
        Clean and normalize a mindmap Mermaid block.
        - remove stray prose and <think> blocks
        - ensure first line is exactly 'mindmap'
        - ensure a single canonical root `root((Label))`
        - normalize indentation to 2 spaces per level
        - sanitize labels (1-4 words, no special chars)
        - prune deepest nodes until total nodes between 12-18 (prefer 12-18)
        """
        if not candidate:
            return candidate

        # remove any residual <think>...</think>
        candidate = re.sub(r"<think>[\s\S]*?<\/think>", "", candidate, flags=re.IGNORECASE).strip()

        lines = [l.rstrip() for l in candidate.splitlines() if l.strip()]
        if not lines:
            return candidate

        # enforce header
        header = lines[0].strip()
        if header.lower() != "mindmap":
            lines[0] = "mindmap"

        body_lines = lines[1:]

        # normalize leading whitespace and sanitize labels
        norm_lines = []
        for ln in body_lines:
            # trim
            raw = ln.rstrip()
            # remove leading non-space tokens before indentation (injected prose)
            m = re.match(r"^(\s*)(.*)$", raw)
            indent = m.group(1) if m else ""
            text = m.group(2) if m else raw

            # strip numeric bullets or prefixes like '1.' or '1)'
            text = re.sub(r"^\s*\d+[\).\-:]?\s*", "", text)

            # sanitize label: remove parentheses around non-root nodes
            text = text.strip()
            # If this line is a root declaration, keep inside later
            # compute approximate level by counting spaces (2 spaces = 1 level)
            level = max(0, len(indent) // 2)

            # sanitize label content to 1-4 words, no special chars
            label = re.sub(r"[^A-Za-z0-9\s\-()]", " ", text)
            label_parts = [p for p in label.split() if p]
            # if this looks like a root((...)) keep content inside parentheses
            root_match = re.match(r"root\(\((.*?)\)\)", text, flags=re.IGNORECASE)
            if root_match:
                label = root_match.group(1)

            label = " ".join(label_parts[:4])
            label = label.strip() or "Node"

            norm_lines.append((level, label))

        # ensure there is a root - if first node is not root, promote first node as root
        if not any(lbl.lower().startswith("root((") or lbl.lower().startswith("root(") for _, lbl in norm_lines):
            # create a root with safe_topic
            root_label = safe_topic or "Topic"
            # insert at top
            norm_lines.insert(0, (0, root_label))

        # Now build a list of node entries (excluding header) with levels
        # If first element has level >0, normalize it to 0 (root)
        if norm_lines and norm_lines[0][0] > 0:
            norm_lines[0] = (0, norm_lines[0][1])

        # Count nodes and prune deepest nodes if too many
        def count_nodes(entries):
            return len(entries)

        total = count_nodes(norm_lines)
        # desired range
        MIN_NODES = 12
        MAX_NODES = 18

        # If too few nodes, we won't invent nodes here — leave to LLM generation
        # If too many, prune deepest nodes first
        if total > MAX_NODES:
            # sort candidate indices by (level desc, index desc) and remove until <= MAX_NODES
            indices = list(range(len(norm_lines)))
            # compute levels
            levels = [lvl for lvl, _ in norm_lines]
            # create prioritized list of indices to remove (deepest, later ones first)
            removable = sorted(indices, key=lambda i: (levels[i], i), reverse=True)
            to_remove = []
            while total - len(to_remove) > MAX_NODES and removable:
                idx = removable.pop(0)
                # never remove root (index 0)
                if idx == 0:
                    continue
                to_remove.append(idx)

            # remove by building new list
            norm_lines = [entry for i, entry in enumerate(norm_lines) if i not in set(to_remove)]

        # Re-normalize levels to avoid level gaps: ensure each level >0 has a parent at level-1 earlier
        cleaned = []
        parent_levels = {0: True}
        for lvl, lbl in norm_lines:
            # clamp level to non-negative
            l = max(0, lvl)
            # if no parent exists for this level, reduce level until it has a parent
            while l > 0 and not any(pl < l for pl in parent_levels.keys()):
                l -= 1
            cleaned.append((l, lbl))
            parent_levels[l] = True

        # Compose mermaid lines: header + root + children
        out_lines = ["mindmap"]

        # First line should be root((Label))
        root_label = cleaned[0][1] if cleaned else (safe_topic or "Topic")
        root_label = re.sub(r"[^A-Za-z0-9\s\-]", " ", root_label).strip()
        root_label = " ".join(root_label.split()[:4]) or "Topic"
        out_lines.append(f"  root(({root_label}))")

        # Add remaining nodes with normalized indentation (2 spaces per level)
        for lvl, lbl in cleaned[1:]:
            # sanitize label
            lab = re.sub(r"[^A-Za-z0-9\s\-]", " ", lbl).strip()
            lab = " ".join(lab.split()[:4]) or "Node"
            indent = "  " * (lvl + 1)  # children of root start at level 1 (two spaces)
            out_lines.append(f"{indent}{lab}")

        return "\n".join(out_lines)

    # exported instance
mindmap_service = MindmapService()