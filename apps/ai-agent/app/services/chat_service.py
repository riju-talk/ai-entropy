"""
Unified Chat Service — strict, stateless, predictable.
Respects external system_prompt. No hidden instructions.
"""

from __future__ import annotations
from datetime import datetime
import re
from typing import List

from app.core.llm import generate_response
from app.schemas.chat import ChatResponse
from app.utils.logger import setup_logger

logger = setup_logger(__name__)

FOLLOWUP_PROMPT = """
Generate exactly 3 highly relevant follow-up questions strictly based on the assistant's answer.

Rules:
- Each question must be short (max 15 words)
- No repeating content from the assistant's answer
- No fluff, no commentary
- Output ONLY:
1. ...
2. ...
3. ...
"""


class ChatService:
    def __init__(self):
        pass  # No hidden state, no LLM stored globally.

    async def chat(self, user_id: str, message: str, system_prompt: str) -> ChatResponse:
        """
        Core chat:
        - Uses the provided system_prompt strictly (no injection of extra personality)
        - Generates answer
        - Generates 3 follow-up questions
        """

        # ----- 1. Generate answer deterministically -----
        answer_prompt = (
            f"{system_prompt.strip()}\n\n"
            f"User: {message.strip()}\n"
            "Assistant:"
        )

        answer_raw = await generate_response(answer_prompt)
        answer = getattr(answer_raw, "content", str(answer_raw))

        # ----- 2. Generate follow-ups -----
        followups = await self._generate_followups(answer)

        # ----- 3. Build response -----
        return ChatResponse(
            session_id=user_id,
            response=answer,
            follow_up_questions=followups,
            credits_used=0.0,
            timestamp=datetime.now(),
        )

    # -------------------------------------------------------------
    # FOLLOW-UP GENERATION
    # -------------------------------------------------------------
    async def _generate_followups(self, assistant_answer: str) -> List[str]:
        prompt = (
            f"Assistant’s Answer:\n{assistant_answer}\n\n"
            f"{FOLLOWUP_PROMPT}"
        )

        raw = await generate_response(prompt)
        text = getattr(raw, "content", str(raw)).strip()
        # Robust parsing: accept numbered forms like '1. ...', '1) ...', '1 - ...'
        followups = []
        for line in text.split("\n"):
            line = line.strip()
            if not line:
                continue
            m = re.match(r"^\s*\d+\s*[\.)\-:]\s*(.+)$", line)
            if m:
                q = m.group(1).strip()
                if q:
                    followups.append(q)
                continue

            # Fallback: if the line looks like a short question (ends with '?'), accept it
            if line.endswith("?") and len(line.split()) <= 15:
                followups.append(line)

        # If we didn't get 3, ask the LLM again, but only once, for the missing count.
        if len(followups) < 3:
            missing = 3 - len(followups)
            try:
                follow_prompt = (
                    f"The assistant's answer:\n{assistant_answer}\n\n"
                    f"You previously returned {len(followups)} follow-up questions. Please now produce exactly {missing} additional concise follow-up questions (max 15 words each), numbered starting at 1, and output ONLY the numbered list."
                )
                raw2 = await generate_response(follow_prompt)
                text2 = getattr(raw2, "content", str(raw2)).strip()
                for line in text2.split("\n"):
                    line = line.strip()
                    if not line:
                        continue
                    m = re.match(r"^\s*\d+\s*[\.)\-:]\s*(.+)$", line)
                    if m:
                        q = m.group(1).strip()
                        if q:
                            followups.append(q)
                    elif line.endswith("?"):
                        followups.append(line)
                    if len(followups) >= 3:
                        break
            except Exception:
                logger.exception("Follow-up regeneration failed")

        # Final safety: pad with generic clarifying questions if still short
        while len(followups) < 3:
            followups.append("Can you clarify your goal?")

        return followups[:3]
