"""
Postgres outbox for the message bus, stored in the existing `event_logs` table.

  eventType   = "bus:<topic>"
  metadata    = the message payload
  processedAt = NULL until every subscriber has finished with the message

If Postgres is unavailable every method degrades to a no-op, so the bus keeps
working purely in memory.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

PREFIX = "bus:"
REPLAY_LIMIT = 500


class PrismaOutbox:
    @staticmethod
    def _db():
        from app.core.database import get_db
        return get_db()

    async def save(self, topic: str, payload: Dict[str, Any]) -> Optional[str]:
        try:
            from prisma.fields import Json
            row = await self._db().eventlog.create(data={
                "eventType": PREFIX + topic,
                "userId": payload.get("user_id"),
                "metadata": Json(payload),
            })
            return row.id
        except Exception as exc:
            logger.debug("Outbox save skipped: %s", exc)
            return None

    async def mark_done(self, outbox_id: str) -> None:
        from datetime import datetime, timezone
        try:
            await self._db().eventlog.update(
                where={"id": outbox_id},
                data={"processedAt": datetime.now(timezone.utc)},
            )
        except Exception as exc:
            logger.debug("Outbox mark_done skipped: %s", exc)

    async def pending(self, topics: List[str]) -> List[Dict[str, Any]]:
        try:
            rows = await self._db().eventlog.find_many(
                where={
                    "processedAt": None,
                    "eventType": {"in": [PREFIX + t for t in topics]},
                },
                order={"emittedAt": "asc"},
                take=REPLAY_LIMIT,
            )
        except Exception as exc:
            logger.debug("Outbox pending skipped: %s", exc)
            return []
        out: List[Dict[str, Any]] = []
        for r in rows:
            payload = r.metadata if isinstance(r.metadata, dict) else {}
            out.append({"id": r.id, "topic": r.eventType[len(PREFIX):], "payload": payload})
        return out
