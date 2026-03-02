"""
High-Quality QuizAgent — rewritten for LangChain ChatGroq
Generates diverse, in-depth MCQs & T/F questions from real LLM-derived research.
"""

from typing import List, Dict
import random
import logging
import re

from app.core.llm import get_llm   # ChatGroq instance

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


# -------------------------------------------------------
# Sentence Utilities
# -------------------------------------------------------

def _clean_sentences(text: str) -> List[str]:
    """
    Removes junk tokens, markdown, <think> garbage, extremely short sentences, etc.
    """
    raw = re.split(r"(?<=[.!?])\s+", text)
    cleaned = []

    for s in raw:
        s = s.strip()

        # reject garbage
        if not s or len(s) < 25:
            continue
        if s.startswith("<") or s.startswith("</"):
            continue
        if "```" in s or "**" in s:
            continue

        cleaned.append(s)

    return cleaned


def _find_candidate_facts(sentences: List[str]) -> List[str]:
    """
    Extracts sentences that contain actual factual anchors:
    dates, numbers, names, events, formulas, comparisons.
    """
    candidates = []

    for s in sentences:
        if re.search(r"\d{3,4}", s):            # years, ranges, data
            candidates.append(s)
            continue
        if re.search(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+", s):  # names
            candidates.append(s)
            continue
        if ":" in s:                            # explicit structured facts
            candidates.append(s)
            continue
        if " vs " in s or " versus " in s:       # comparisons
            candidates.append(s)

    return candidates


# -------------------------------------------------------
# Distractor Generator
# -------------------------------------------------------

def _generate_distractors(answer: str, sentence: str) -> List[str]:
    distractors = set()

    # numeric distractors
    nums = re.findall(r"\d+", sentence)
    for n in nums[:2]:
        val = int(n)
        distractors.add(str(val + random.randint(2, 12)))
        distractors.add(str(max(1, val - random.randint(2, 12))))

    # proper-noun distractors
    names = re.findall(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b", sentence)
    for nm in names[:2]:
        distractors.add(nm)
        distractors.add(nm.split()[0])
        if " " in nm:
            distractors.add(" ".join(reversed(nm.split())))

    # generic filler
    while len(distractors) < 3:
        distractors.add(answer + " (alt)")

    distractors.discard(answer)
    return list(distractors)[:3]


# =======================================================
# Quiz Agent — REWRITTEN
# =======================================================

class QuizAgent:

    def __init__(self):
        self.llm = get_llm()

    # ---------------------------------------------------
    # MAIN METHOD
    # ---------------------------------------------------

    async def generate_quiz(
        self,
        user_id: str,
        topic: str,
        num_questions: int = 5,
        question_types: List[str] = None,
        difficulty: str = "medium",
        research: bool = True
    ) -> List[Dict]:

        if question_types is None:
            question_types = ["mcq", "true_false"]

        logger.info(f"Generating quiz for '{topic}'...")

        # ----- LLM RESEARCH -----
        research_text = await self._research_topic(topic) if research else ""
        sentences = _clean_sentences(research_text)
        facts = _find_candidate_facts(sentences)

        # fallback: minimal facts
        if not facts:
            facts = sentences or [f"{topic} is commonly used across various domains."]

        questions = []

        for i in range(num_questions):
            qtype = question_types[i % len(question_types)]
            fact = random.choice(facts)

            if qtype == "mcq":
                q = self._make_mcq(fact, difficulty)
            else:
                q = self._make_tf(fact, difficulty)

            questions.append(q)

        return questions

    # ---------------------------------------------------
    # RESEARCH PROMPT — rewritten
    # ---------------------------------------------------

    async def _research_topic(self, topic: str) -> str:
        prompt = f"""
You are generating factual material for quiz questions.

Produce **8–10 unique bullet-point facts** about the topic:

Topic: {topic}

Each bullet MUST be a standalone fact:
- One historical/timeline fact
- One definition or core concept
- One formula or quantitative detail (if applicable)
- One real-world application
- One key contributor / researcher
- One comparative insight (A vs B, or before vs after)
- One limitation or controversy
- One surprising or lesser-known fact
- Each fact must be different, no overlap.

Rules:
- No explanations or reasoning.
- No fluff.
- No markdown, no numbering. Just plain bullet facts separated by periods.
"""

        try:
            # Gemini typically accepts tuples or Message objects
            out = await self.llm.ainvoke([("human", prompt)])
            # Some LLM wrappers return an object with `content`, others return a plain string.
            text = getattr(out, "content", None) or out or ""
            return str(text).strip()
        except Exception as e:
            logger.error(f"Research error: {e}")
            return ""

    # ---------------------------------------------------
    # MCQ Generation (diverse styles)
    # ---------------------------------------------------

    def _make_mcq(self, fact: str, difficulty: str) -> Dict:

        # Identify answer anchor
        m_year = re.search(r"\d{3,4}", fact)
        m_name = re.search(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b", fact)

        if m_year:
            answer = m_year.group(0)
        elif m_name:
            answer = m_name.group(0)
        else:
            answer = fact.split()[0].rstrip(".,:")

        distractors = _generate_distractors(answer, fact)
        options = distractors + [answer]
        # ensure unique options and limit to a reasonable number
        seen = []
        for o in options:
            if o not in seen:
                seen.append(o)
        options = seen[:4] if len(seen) >= 4 else seen
        random.shuffle(options)

        # MCQ phrasing templates
        templates = [
            f"Fill in the blank: {fact.replace(answer, '_____')}",
            f"Which value correctly completes this statement?\n{fact.replace(answer, '_____')}",
            f"Based on factual records, what completes this statement?\n{fact.replace(answer, '_____')}",
            f"What key detail is missing from the following description?\n{fact.replace(answer, '_____')}",
        ]

        question_text = random.choice(templates)

        # Defensive: ensure answer is present and compute index
        if answer not in options:
            options.append(answer)
        try:
            correct_idx = options.index(answer)
        except ValueError:
            correct_idx = 0

        return {
            "type": "mcq",
            "question": question_text,
            "options": options,
            "correctAnswer": correct_idx,
            "explanation": fact,
            "difficulty": difficulty,
        }

    # ---------------------------------------------------
    # True/False generation
    # ---------------------------------------------------

    def _make_tf(self, fact: str, difficulty: str) -> Dict:
        stmt = fact
        is_true = True

        # 30–40% chance to flip meaning
        if random.random() < 0.4:
            if " is " in stmt:
                stmt = stmt.replace(" is ", " is not ", 1)
            else:
                stmt = "It is not true that " + stmt
            is_true = False

        return {
            "type": "true_false",
            "question": stmt,
            "options": ["True", "False"],
            "correctAnswer": 0 if is_true else 1,
            "explanation": fact,
            "difficulty": difficulty
        }


# -------------------------------------------------------
# Service Adapter
# -------------------------------------------------------

async def _agent_generate_adapter(agent: QuizAgent, *, topic: str, num_questions: int = 5, difficulty: str = "medium", custom_prompt: str = None, **kwargs):
    return await agent.generate_quiz(
        user_id="user",
        topic=topic,
        num_questions=num_questions,
        difficulty=difficulty
    )


class _QuizServiceWrapper:
    def __init__(self, agent):
        self._agent = agent

    async def generate(self, **kwargs):
        return await _agent_generate_adapter(self._agent, **kwargs)


quiz_service = _QuizServiceWrapper(QuizAgent())
