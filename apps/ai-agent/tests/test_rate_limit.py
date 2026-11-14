"""Rate limiter: sliding windows, concurrency slots, global cap, identity trust. A fake clock keeps it instant."""
import asyncio
import json
import os
import pathlib
import sys

os.environ["AI_BACKEND_TOKEN"] = "test-token"
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

import pytest  # noqa: E402

from app.middleware.rate_limit import ConcurrencyLimiter, RateLimitMiddleware, Rule, SlidingWindowLimiter, client_key  # noqa: E402


class Clock:
    def __init__(self):
        self.t = 1000.0

    def __call__(self):
        return self.t


def test_allows_up_to_the_limit_then_blocks_with_retry_after():
    c = Clock()
    lim = SlidingWindowLimiter(clock=c)
    results = [lim.check("k", ((3, 60),)) for _ in range(4)]
    assert [r[0] for r in results] == [True, True, True, False]
    assert 1 <= results[3][1] <= 60


def test_window_slides_instead_of_resetting_all_at_once():
    c = Clock()
    lim = SlidingWindowLimiter(clock=c)
    lim.check("k", ((2, 60),))       # t=0
    c.t += 30
    lim.check("k", ((2, 60),))       # t=30
    assert not lim.check("k", ((2, 60),))[0]
    c.t += 31                         # t=61: the first request aged out, the second has not
    assert lim.check("k", ((2, 60),))[0]
    assert not lim.check("k", ((2, 60),))[0]


def test_every_window_must_have_room():
    c = Clock()
    lim = SlidingWindowLimiter(clock=c)
    windows = ((10, 60), (3, 3600))   # generous per minute, tight per hour
    assert all(lim.check("k", windows)[0] for _ in range(3))
    c.t += 120                        # the minute window is clear but the hour window is not
    ok, retry, *_ = lim.check("k", windows)
    assert not ok and retry > 3000


def test_keys_are_independent_and_idle_keys_are_garbage_collected():
    c = Clock()
    lim = SlidingWindowLimiter(clock=c, gc_interval=10)
    assert lim.check("a", ((1, 60),))[0] and lim.check("b", ((1, 60),))[0]
    assert not lim.check("a", ((1, 60),))[0]
    c.t += 200
    lim.check("c", ((1, 60),))
    assert lim.size() == 1  # a and b aged out and were dropped


def test_stored_timestamps_are_bounded():
    lim = SlidingWindowLimiter(clock=Clock())
    for _ in range(500):
        lim.check("k", ((5, 60),))
    assert len(lim._log["k"]) <= 5


def test_concurrency_slots_are_counted_and_released():
    cl = ConcurrencyLimiter()
    assert cl.acquire("u", 2) and cl.acquire("u", 2) and not cl.acquire("u", 2)
    cl.release("u")
    assert cl.acquire("u", 2)
    cl.release("u"); cl.release("u")
    assert cl.current("u") == 0


# ── middleware, driven as raw ASGI ────────────────────────────────────────────────────────────

def _scope(path="/api/qa/stream", method="POST", headers=None, client=("1.2.3.4", 5)):
    h = [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()]
    return {"type": "http", "path": path, "method": method, "headers": h, "client": client}


async def _call(mw, scope):
    sent = []

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(m):
        sent.append(m)

    await mw(scope, receive, send)
    start = next(m for m in sent if m["type"] == "http.response.start")
    body = b"".join(m.get("body", b"") for m in sent if m["type"] == "http.response.body")
    return start["status"], dict(start["headers"]), body


def _mw(app, rules, **kw):
    return RateLimitMiddleware(app, rules=rules, limiter=SlidingWindowLimiter(clock=Clock()), **kw)


async def _ok_app(scope, receive, send):
    await send({"type": "http.response.start", "status": 200, "headers": []})
    await send({"type": "http.response.body", "body": b"ok"})


AUTH = {"x-internal-token": "test-token", "x-user-id": "alice"}


def test_returns_429_with_retry_after_and_json_body():
    mw = _mw(_ok_app, [Rule("t", "/api/qa", ((2, 60),))])
    statuses = [asyncio.run(_call(mw, _scope(headers=AUTH)))[0] for _ in range(3)]
    assert statuses == [200, 200, 429]
    status, headers, body = asyncio.run(_call(mw, _scope(headers=AUTH)))
    assert status == 429 and int(headers[b"retry-after"]) >= 1
    assert json.loads(body)["code"] == "rate_limited"


def test_successful_responses_carry_ratelimit_headers():
    mw = _mw(_ok_app, [Rule("t", "/api/qa", ((5, 60),))])
    _, headers, _ = asyncio.run(_call(mw, _scope(headers=AUTH)))
    assert headers[b"x-ratelimit-limit"] == b"5" and headers[b"x-ratelimit-remaining"] == b"4"


def test_users_behind_one_proxy_ip_are_limited_separately():
    mw = _mw(_ok_app, [Rule("t", "/api/qa", ((1, 60),))])
    a = {**AUTH, "x-user-id": "alice"}
    b = {**AUTH, "x-user-id": "bob"}
    assert asyncio.run(_call(mw, _scope(headers=a)))[0] == 200
    assert asyncio.run(_call(mw, _scope(headers=a)))[0] == 429
    assert asyncio.run(_call(mw, _scope(headers=b)))[0] == 200


def test_a_forged_user_id_without_the_service_token_cannot_dodge_the_limit():
    mw = _mw(_ok_app, [Rule("t", "/api/qa", ((1, 60),))])
    assert asyncio.run(_call(mw, _scope(headers={"x-user-id": "u1"})))[0] == 200
    # Changing the claimed user id does nothing: without a valid token we key on the IP.
    assert asyncio.run(_call(mw, _scope(headers={"x-user-id": "u2"})))[0] == 429
    assert asyncio.run(_call(mw, _scope(headers={"x-internal-token": "wrong", "x-user-id": "u3"})))[0] == 429


def test_spoofed_leftmost_forwarded_for_is_ignored():
    # Our proxy appends the real client IP on the right; a client can only forge entries on the left.
    a = client_key(_scope(headers={"x-forwarded-for": "9.9.9.9, 7.7.7.7"}))
    b = client_key(_scope(headers={"x-forwarded-for": "1.1.1.1, 7.7.7.7"}))
    assert a == b == "ip:7.7.7.7"


def test_health_and_preflight_are_never_limited():
    mw = _mw(_ok_app, [Rule("d", "/", ((1, 60),), methods=("GET", "POST", "OPTIONS"))])
    for _ in range(5):
        assert asyncio.run(_call(mw, _scope(path="/health", method="GET")))[0] == 200
        assert asyncio.run(_call(mw, _scope(method="OPTIONS")))[0] == 200


def test_global_limit_protects_the_provider_across_users():
    mw = _mw(_ok_app, [Rule("t", "/api/qa", ((50, 60),), llm=True)], global_llm=((3, 60),))
    codes = [asyncio.run(_call(mw, _scope(headers={**AUTH, "x-user-id": f"u{i}"})))[0] for i in range(5)]
    assert codes == [200, 200, 200, 429, 429]
    _, _, body = asyncio.run(_call(mw, _scope(headers={**AUTH, "x-user-id": "u9"})))
    assert json.loads(body)["code"] == "service_busy"


def test_concurrent_streams_are_capped_and_slots_free_on_completion_and_on_error():
    gate = asyncio.Event()

    async def slow_app(scope, receive, send):
        await gate.wait()
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b"x"})

    async def boom_app(scope, receive, send):
        raise RuntimeError("stream crashed")

    async def scenario():
        rule = Rule("t", "/api/qa", ((100, 60),), max_concurrent=1, concurrency_paths=("/api/qa/stream",))
        mw = _mw(slow_app, [rule])
        first = asyncio.create_task(_call(mw, _scope(headers=AUTH)))
        await asyncio.sleep(0.01)
        status, _, body = await _call(mw, _scope(headers=AUTH))   # second stream while the first is open
        assert status == 429 and json.loads(body)["code"] == "too_many_streams"
        gate.set()
        assert (await first)[0] == 200
        assert (await _call(mw, _scope(headers=AUTH)))[0] == 200     # slot was released

        crash = _mw(boom_app, [rule])
        with pytest.raises(RuntimeError):
            await _call(crash, _scope(headers=AUTH))
        assert crash.streams.current("t:user:alice") == 0            # released even though the app raised

    asyncio.run(scenario())


def test_slot_is_released_when_the_client_disconnects_mid_stream():
    async def scenario():
        started = asyncio.Event()

        async def streaming_app(scope, receive, send):
            await send({"type": "http.response.start", "status": 200, "headers": []})
            started.set()
            await asyncio.sleep(30)  # a long answer

        rule = Rule("t", "/api/qa", ((100, 60),), max_concurrent=1, concurrency_paths=("/api/qa/stream",))
        mw = _mw(streaming_app, [rule])
        task = asyncio.create_task(_call(mw, _scope(headers=AUTH)))
        await started.wait()
        assert mw.streams.current("t:user:alice") == 1
        task.cancel()                                               # what the server does when the client goes away
        with pytest.raises(asyncio.CancelledError):
            await task
        assert mw.streams.current("t:user:alice") == 0

    asyncio.run(scenario())
