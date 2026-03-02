"""
Flashcard Generation Service — Clean, Direct, JSON-Safe Version
"""

import json
import re
import wikipedia
import logging

from typing import List, Dict
from app.core.llm import get_llm
from app.utils.logger import setup_logger

logger = setup_logger(__name__)

JSON_EXTRACT = re.compile(r"\[.*?\]", re.DOTALL)


class FlashcardService:
    def __init__(self):
        self.llm = get_llm()

    # -------------------------------------------------------
    # PUBLIC METHOD — matches your route EXACTLY
    # -------------------------------------------------------
    async def generate_flashcards(self, topic: str, count: int, custom_prompt: str = None):
        """
        WHAT THE ROUTE CALLS.
        topic: string
        count: number of flashcards
        custom_prompt: optional override
        """
        try:
            research = await self._quick_research(topic)

            prompt = self._build_prompt(
                topic=topic,
                count=count,
                research=research,
                custom_prompt=custom_prompt
            )

            raw = await self._llm_call(prompt)
            json_text = self._extract_json(raw)
            cards = self._parse_cards(json_text, count)

            return cards

        except Exception as e:
            logger.error(f"Flashcard generation failed: {e}", exc_info=True)
            return self._fallback(topic, count)

    # -------------------------------------------------------
    # LLM CALL (ChatGroq ainvoke)
    # -------------------------------------------------------
    async def _llm_call(self, prompt: str) -> str:
        try:
            result = await self.llm.ainvoke([{"role": "user", "content": prompt}])
            return (result.content or "").strip()
        except Exception as e:
            logger.error(f"LLM error: {e}")
            return ""

    # -------------------------------------------------------
    # JSON Extraction
    # -------------------------------------------------------
    def _extract_json(self, text: str) -> str:
        text = re.sub(r"```.*?```", "", text, flags=re.DOTALL)
        match = JSON_EXTRACT.search(text)
        return match.group(0).strip() if match else ""

    # -------------------------------------------------------
    # JSON Parsing
    # -------------------------------------------------------
    def _parse_cards(self, text: str, count: int):
        if not text:
            return self._fallback("Unknown", count)

        try:
            data = json.loads(text)
            if not isinstance(data, list):
                raise ValueError("Not a JSON list")

            valid = [
                c for c in data
                if isinstance(c, dict) and "front" in c and "back" in c
            ]

            if len(valid) < count:
                raise ValueError("Too few valid cards")

            return valid[:count]

        except Exception as e:
            logger.error(f"JSON parse error: {e}")
            return self._fallback("Unknown", count)

    # -------------------------------------------------------
    # Wikipedia Research
    # -------------------------------------------------------
    async def _quick_research(self, topic: str) -> str:
        try:
            r = wikipedia.search(topic, results=1)
            if not r:
                return ""
            summary = wikipedia.summary(r[0], sentences=5)
            return summary[:1200]
        except Exception:
            return ""

    # -------------------------------------------------------
    # Prompt Builder (respects custom_prompt)
    # -------------------------------------------------------
    def _build_prompt(self, topic: str, count: int, research: str, custom_prompt: str):
        if custom_prompt and custom_prompt.strip():
            extra = f"\nAdditional constraints:\n{custom_prompt}\n"
        else:
            extra = ""

        return f"""
Your output MUST be ONLY a JSON array. No text outside JSON.

Generate EXACTLY {count} high-quality flashcards.

Topic: {topic}

Context (do NOT repeat directly):
\"\"\"
{research}
\"\"\"

Rules:
- Output STRICT JSON: [{{"front":"...","back":"..."}}, ...]
- Each card must be unique.
- "front": short, exam-style question or concept.
- "back": concise factual explanation.
- Cover definitions, facts, mechanisms, examples, misconceptions, history, and at least one deeper “why/how” card.
{extra}

Example output:
[
  {{"front": "What is X?", "back": "X is ..."}},
  {{"front": "How does Y work?", "back": "Y works by ..."}}
]
"""

    # -------------------------------------------------------
    # Fallback Cards
    # -------------------------------------------------------
    def _fallback(self, topic: str, count: int):
        return [
            {
                "front": f"Basic concept of {topic}",
                "back": "Fallback explanation due to formatting failure."
            }
            for _ in range(count)
        ]


# Export service (NO WRAPPER)
flashcard_service = FlashcardService()
