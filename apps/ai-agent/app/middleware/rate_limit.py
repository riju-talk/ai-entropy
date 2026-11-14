"""
Rate limiting for the AI service. Hand-rolled, in-process, no external store.

Three independent guards, all enforced in one pure-ASGI middleware (pure ASGI, not BaseHTTPMiddleware, so a
client disconnect during an SSE answer reliably releases its slot instead of leaking it):

1. Sliding-window limits per caller - several windows per rule (e.g. 12/minute AND 120/hour).
   The window is a log of request timestamps, so there is no "burst at the window edge" loophole that a
   fixed-window counter has. Stored timestamps per key are capped at the largest limit, so memory is bounded.
2. A concurrency cap on open answer streams per caller. Each stream holds a slot until the response ends,
   whether it finished, errored, or the client went away.
3. A global limit across every LLM-backed route, so a crowd of users cannot burn the Groq quota for everyone.

Who is "the caller"? Behind the Next.js server every request arrives from the same IP, so the key is the user id
the server forwards in X-User-Id - but ONLY when X-Internal-Token proves the request came from that server.
Anonymous or unverified callers are keyed by IP: the right-most X-Forwarded-For entry (the one appended by our
own proxy; the left-most is client-controlled and spoofable) when TRUST_PROXY_HEADERS is on, else the socket peer.

State is per process. Run N workers and each enforces its own counters (limits are N times looser); put the
counters in Redis if you scale out. For the single Render instance this service targets, in-process is exact.
"""
from __future__ import annotations

import hmac
import json
import logging
import math
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Callable, Deque, Dict, List, Optional, Tuple

from starlette.types import ASGIApp, Message, Receive, Scope, Send

logger = logging.getLogger(__name__)

Window = Tuple[int, int]  # (max requests, seconds)


@dataclass(frozen=True)
class Rule:
    name: str
    prefix: str
    windows: Tuple[Window, ...]
    methods: Tuple[str, ...] = ("POST", "PUT", "PATCH", "DELETE")
    max_concurrent: int = 0       # 0 = no concurrency cap
    llm: bool = False             # also counts against the global LLM limit
    concurrency_paths: Tuple[str, ...] = ()  # when set, the concurrency cap applies only to these exact paths


def build_rules() -> List[Rule]:
    """Rules in priority order: first prefix match wins. Built from settings so they are tunable per deploy."""
    from app.core.config import settings as s

    return [
        Rule("tutor", "/api/qa", ((s.TUTOR_RATE_PER_MINUTE, 60), (s.TUTOR_RATE_PER_HOUR, 3600)),
             max_concurrent=s.TUTOR_MAX_CONCURRENT_STREAMS, concurrency_paths=("/api/qa/stream",), llm=True),
        Rule("reasoning", "/api/reasoning", ((10, 60), (100, 3600)), llm=True),
        Rule("evaluation", "/api/evaluation", ((10, 60),), llm=True),
        Rule("quiz", "/api/quiz", ((10, 60),), llm=True),
        Rule("mindmap", "/api/mindmap", ((10, 60),), llm=True),
        Rule("flashcards", "/api/flashcards", ((10, 60),), llm=True),
        Rule("documents", "/api/documents", ((30, 60),)),
        Rule("default", "/api", ((120, 60),), methods=("GET", "POST", "PUT", "PATCH", "DELETE")),
    ]


class SlidingWindowLimiter:
    """Timestamp-log limiter. `check` is the only mutating call; it records the request only when allowed."""

    def __init__(self, clock: Callable[[], float] = time.monotonic, gc_interval: float = 60.0):
        self._clock = clock
        self._log: Dict[str, Deque[float]] = {}
        self._horizon: Dict[str, int] = {}  # longest window seen per key, for garbage collection
        self._gc_interval = gc_interval
        self._last_gc = clock()

    def check(self, key: str, windows: Tuple[Window, ...]) -> Tuple[bool, int, int, int]:
        """Return (allowed, retry_after_s, remaining_in_tightest_window, limit_of_tightest_window).

        All windows must have room. The tightest (lowest remaining) window is what we report in headers.
        """
        now = self._clock()
        self._maybe_gc(now)
        q = self._log.setdefault(key, deque())
        longest = max(w for _, w in windows)
        self._horizon[key] = max(self._horizon.get(key, 0), longest)
        while q and q[0] <= now - longest:
            q.popleft()

        retry_after = 0
        tightest = (math.inf, 0)  # (remaining, limit)
        for limit, seconds in windows:
            in_window = [t for t in q if t > now - seconds]
            remaining = limit - len(in_window)
            if remaining <= 0:
                # The window frees a slot when its oldest entry ages out.
                retry_after = max(retry_after, math.ceil(in_window[0] + seconds - now) if in_window else seconds)
            if remaining < tightest[0]:
                tightest = (remaining, limit)
        if retry_after:
            return False, max(1, retry_after), 0, int(tightest[1])
        q.append(now)
        cap = max(limit for limit, _ in windows)
        while len(q) > cap:  # never store more than the largest limit allows
            q.popleft()
        return True, 0, max(0, int(tightest[0]) - 1), int(tightest[1])

    def _maybe_gc(self, now: float) -> None:
        if now - self._last_gc < self._gc_interval:
            return
        self._last_gc = now
        for key in list(self._log):
            q = self._log[key]
            horizon = self._horizon.get(key, 3600)
            while q and q[0] <= now - horizon:
                q.popleft()
            if not q:
                del self._log[key]
                self._horizon.pop(key, None)

    def size(self) -> int:
        return len(self._log)


class ConcurrencyLimiter:
    """Counts open streams per key. Always pair acquire() with release() in a finally block."""

    def __init__(self) -> None:
        self._open: Dict[str, int] = {}

    def acquire(self, key: str, limit: int) -> bool:
        if self._open.get(key, 0) >= limit:
            return False
        self._open[key] = self._open.get(key, 0) + 1
        return True

    def release(self, key: str) -> None:
        n = self._open.get(key, 0) - 1
        if n > 0:
            self._open[key] = n
        else:
            self._open.pop(key, None)

    def current(self, key: str) -> int:
        return self._open.get(key, 0)


def _header(scope: Scope, name: bytes) -> str:
    for k, v in scope.get("headers", []):
        if k == name:
            return v.decode("latin-1")
    return ""


def client_key(scope: Scope) -> str:
    """Stable identity for the caller (see module docstring for the trust model)."""
    from app.core.config import settings

    token = settings.AI_BACKEND_TOKEN or ""
    supplied = _header(scope, b"x-internal-token")
    if token and supplied and hmac.compare_digest(supplied.encode(), token.encode()):
        uid = _header(scope, b"x-user-id").strip()
        if uid:
            return f"user:{uid[:128]}"
    if settings.TRUST_PROXY_HEADERS:
        forwarded = [p.strip() for p in _header(scope, b"x-forwarded-for").split(",") if p.strip()]
        if forwarded:
            return f"ip:{forwarded[-1]}"
    client = scope.get("client")
    return f"ip:{client[0] if client else 'unknown'}"


class RateLimitMiddleware:
    """Pure ASGI middleware enforcing the rules above. Health checks and CORS preflights are never limited."""

    def __init__(self, app: ASGIApp, rules: Optional[List[Rule]] = None,
                 limiter: Optional[SlidingWindowLimiter] = None, streams: Optional[ConcurrencyLimiter] = None,
                 global_llm: Optional[Tuple[Window, ...]] = None):
        from app.core.config import settings

        self.app = app
        self.rules = rules if rules is not None else build_rules()
        self.limiter = limiter or SlidingWindowLimiter()
        self.streams = streams or ConcurrencyLimiter()
        self.global_llm = global_llm if global_llm is not None else ((settings.GLOBAL_LLM_RATE_PER_MINUTE, 60),)
        self.enabled = settings.RATE_LIMIT_ENABLED

    def _rule_for(self, path: str, method: str) -> Optional[Rule]:
        for rule in self.rules:
            if path.startswith(rule.prefix):
                return rule if method in rule.methods else None
        return None

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or not self.enabled:
            return await self.app(scope, receive, send)
        path, method = scope["path"], scope["method"]
        if path in ("/health", "/") or method == "OPTIONS":
            return await self.app(scope, receive, send)
        rule = self._rule_for(path, method)
        if rule is None:
            return await self.app(scope, receive, send)

        key = client_key(scope)
        allowed, retry_after, remaining, limit = self.limiter.check(f"{rule.name}:{key}", rule.windows)
        scope_name = "caller"
        if allowed and rule.llm:
            g_allowed, g_retry, _, _ = self.limiter.check("global:llm", self.global_llm)
            if not g_allowed:
                allowed, retry_after, scope_name = False, g_retry, "service"
        if not allowed:
            logger.warning("rate limit: %s %s %s (%s) retry in %ss", key, method, path, scope_name, retry_after)
            return await self._reject(send, 429, retry_after, limit,
                                      "Too many requests. Please wait a moment and try again."
                                      if scope_name == "caller" else "The AI tutor is busy right now. Please retry shortly.",
                                      "rate_limited" if scope_name == "caller" else "service_busy")

        hold_slot = bool(rule.max_concurrent) and (not rule.concurrency_paths or path in rule.concurrency_paths)
        slot_key = f"{rule.name}:{key}"
        if hold_slot and not self.streams.acquire(slot_key, rule.max_concurrent):
            return await self._reject(send, 429, 5, rule.max_concurrent,
                                      "You already have answers in progress. Wait for one to finish or stop it first.",
                                      "too_many_streams")

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers += [(b"x-ratelimit-limit", str(limit).encode()), (b"x-ratelimit-remaining", str(remaining).encode())]
                message = {**message, "headers": headers}
            await send(message)

        try:
            await self.app(scope, receive, send_with_headers)
        finally:
            if hold_slot:
                self.streams.release(slot_key)  # runs on completion, error, client disconnect and task cancellation

    @staticmethod
    async def _reject(send: Send, status: int, retry_after: int, limit: int, message: str, code: str) -> None:
        body = json.dumps({"detail": message, "error": message, "code": code, "retry_after": retry_after}).encode()
        await send({"type": "http.response.start", "status": status, "headers": [
            (b"content-type", b"application/json"), (b"content-length", str(len(body)).encode()),
            (b"retry-after", str(retry_after).encode()), (b"x-ratelimit-limit", str(limit).encode()),
            (b"x-ratelimit-remaining", b"0"),
        ]})
        await send({"type": "http.response.body", "body": body})
