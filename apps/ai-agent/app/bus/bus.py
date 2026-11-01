"""
In-process message bus (replaces SQS + Lambda workers).

  publish(topic, payload)  ->  outbox row (durable)  ->  one bounded queue per subscriber
                                                     ->  worker tasks  ->  handler(payload)

Guarantees
----------
- At-least-once delivery: a failed handler is retried with exponential backoff;
  after `max_attempts` the message is dead-lettered (logged and kept in memory).
- Durability across restarts: when an outbox is configured, unfinished messages
  are replayed on `start()`. Handlers must therefore be idempotent.
- Back-pressure: queues are bounded; when full, a publish is dropped from the
  in-memory queue (it stays in the outbox and is replayed on the next start).
- The bus never raises into the caller: `publish` returns False instead.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Deque, Dict, List, Optional, Protocol

logger = logging.getLogger(__name__)

Handler = Callable[[Dict[str, Any]], Awaitable[None]]


class Outbox(Protocol):
    async def save(self, topic: str, payload: Dict[str, Any]) -> Optional[str]: ...
    async def mark_done(self, outbox_id: str) -> None: ...
    async def pending(self, topics: List[str]) -> List[Dict[str, Any]]: ...


@dataclass
class _Message:
    topic: str
    payload: Dict[str, Any]
    outbox_id: Optional[str] = None
    remaining: int = 0          # subscribers that have not finished with this message
    created: float = field(default_factory=time.time)


@dataclass
class _Subscription:
    topic: str
    handler: Handler
    queue: "asyncio.Queue[tuple[_Message, int]]"
    workers: int
    tasks: List["asyncio.Task[None]"] = field(default_factory=list)


class MessageBus:
    def __init__(
        self,
        outbox: Optional[Outbox] = None,
        queue_size: int = 1000,
        max_attempts: int = 3,
        backoff_base: float = 1.0,
    ):
        self._outbox = outbox
        self._queue_size = queue_size
        self._max_attempts = max_attempts
        self._backoff_base = backoff_base
        self._subs: Dict[str, List[_Subscription]] = {}
        self._running = False
        self.dead_letters: Deque[Dict[str, Any]] = deque(maxlen=100)
        self._stats = {"published": 0, "delivered": 0, "retried": 0, "dead": 0, "dropped": 0}

    # -- wiring ------------------------------------------------------------------

    def set_outbox(self, outbox: Optional[Outbox]) -> None:
        self._outbox = outbox

    def subscribe(self, topic: str, handler: Handler, workers: int = 1) -> None:
        sub = _Subscription(topic, handler, asyncio.Queue(self._queue_size), max(1, workers))
        self._subs.setdefault(topic, []).append(sub)
        if self._running:
            self._spawn(sub)

    def on(self, topic: str, workers: int = 1) -> Callable[[Handler], Handler]:
        """Decorator form of `subscribe`."""
        def deco(fn: Handler) -> Handler:
            self.subscribe(topic, fn, workers)
            return fn
        return deco

    # -- lifecycle -----------------------------------------------------------------

    def _spawn(self, sub: _Subscription) -> None:
        for i in range(sub.workers):
            name = f"bus:{sub.topic}:{getattr(sub.handler, '__name__', 'handler')}:{i}"
            sub.tasks.append(asyncio.create_task(self._worker(sub), name=name))

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        for subs in self._subs.values():
            for sub in subs:
                self._spawn(sub)
        await self._replay()
        logger.info("MessageBus started: topics=%s", sorted(self._subs))

    async def stop(self, timeout: float = 10.0) -> None:
        """Drain queues (up to `timeout` seconds), then cancel the workers."""
        if not self._running:
            return
        try:
            await asyncio.wait_for(
                asyncio.gather(*(s.queue.join() for subs in self._subs.values() for s in subs)),
                timeout,
            )
        except asyncio.TimeoutError:
            logger.warning("MessageBus stop: queues not drained after %.0fs", timeout)
        self._running = False
        tasks = [t for subs in self._subs.values() for s in subs for t in s.tasks]
        for t in tasks:
            t.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        for subs in self._subs.values():
            for s in subs:
                s.tasks.clear()

    # -- publish ---------------------------------------------------------------------

    async def publish(self, topic: str, payload: Dict[str, Any]) -> bool:
        """Durably record, then enqueue for every subscriber of `topic`. Never raises."""
        try:
            subs = self._subs.get(topic, [])
            outbox_id = None
            if self._outbox is not None:
                outbox_id = await self._outbox.save(topic, payload)
            if not subs:
                logger.debug("No subscribers for topic %s", topic)
                if outbox_id and self._outbox:
                    await self._outbox.mark_done(outbox_id)
                return True
            self._stats["published"] += 1
            self._enqueue(_Message(topic, payload, outbox_id), subs)
            return True
        except Exception as exc:  # never break the request path
            logger.warning("publish(%s) failed: %s", topic, exc)
            return False

    def _enqueue(self, msg: _Message, subs: List[_Subscription]) -> None:
        msg.remaining = len(subs)
        for sub in subs:
            try:
                sub.queue.put_nowait((msg, 1))
            except asyncio.QueueFull:
                self._stats["dropped"] += 1
                logger.warning("Queue full for %s; message stays in outbox for replay", sub.topic)
                msg.remaining -= 1  # not delivered now; the outbox row is kept unfinished

    async def _replay(self) -> None:
        if self._outbox is None:
            return
        try:
            rows = await self._outbox.pending(list(self._subs))
        except Exception as exc:
            logger.warning("Outbox replay skipped: %s", exc)
            return
        for row in rows:
            self._enqueue(_Message(row["topic"], row["payload"], row["id"]), self._subs[row["topic"]])
        if rows:
            logger.info("MessageBus replayed %d unfinished message(s)", len(rows))

    # -- workers -----------------------------------------------------------------------

    async def _worker(self, sub: _Subscription) -> None:
        while True:
            msg, attempt = await sub.queue.get()
            try:
                await sub.handler(msg.payload)
                self._stats["delivered"] += 1
                await self._finish(msg)
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                if attempt < self._max_attempts:
                    self._stats["retried"] += 1
                    delay = self._backoff_base * (2 ** (attempt - 1))
                    logger.warning("%s attempt %d failed (%s); retry in %.1fs", sub.topic, attempt, exc, delay)
                    asyncio.get_running_loop().call_later(delay, self._requeue, sub, msg, attempt + 1)
                else:
                    self._stats["dead"] += 1
                    self.dead_letters.append({"topic": sub.topic, "payload": msg.payload, "error": str(exc)})
                    logger.error("%s dead-lettered after %d attempts: %s", sub.topic, attempt, exc)
                    await self._finish(msg)
            finally:
                sub.queue.task_done()

    def _requeue(self, sub: _Subscription, msg: _Message, attempt: int) -> None:
        try:
            sub.queue.put_nowait((msg, attempt))
        except asyncio.QueueFull:
            self._stats["dropped"] += 1
            logger.warning("Retry for %s dropped: queue full", sub.topic)

    async def _finish(self, msg: _Message) -> None:
        msg.remaining -= 1
        if msg.remaining <= 0 and msg.outbox_id and self._outbox is not None:
            try:
                await self._outbox.mark_done(msg.outbox_id)
            except Exception as exc:
                logger.warning("Outbox mark_done failed: %s", exc)

    # -- introspection ------------------------------------------------------------------

    def stats(self) -> Dict[str, Any]:
        depth = {t: sum(s.queue.qsize() for s in subs) for t, subs in self._subs.items()}
        return {**self._stats, "queue_depth": depth, "dead_letters": len(self.dead_letters)}


_bus: Optional[MessageBus] = None


def get_bus() -> MessageBus:
    """Process-wide bus instance."""
    global _bus
    if _bus is None:
        _bus = MessageBus()
    return _bus
