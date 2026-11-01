"""MessageBus behaviour: delivery, retry, dead-lettering, outbox replay. Stdlib only."""
import asyncio
import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from app.bus.bus import MessageBus  # noqa: E402


class MemoryOutbox:
    def __init__(self):
        self.rows = {}
        self._n = 0

    async def save(self, topic, payload):
        self._n += 1
        rid = str(self._n)
        self.rows[rid] = {"id": rid, "topic": topic, "payload": payload, "done": False}
        return rid

    async def mark_done(self, outbox_id):
        self.rows[outbox_id]["done"] = True

    async def pending(self, topics):
        return [r for r in self.rows.values() if not r["done"] and r["topic"] in topics]


async def _settle(bus, timeout=5.0):
    await asyncio.wait_for(asyncio.gather(*(s.queue.join() for subs in bus._subs.values() for s in subs)), timeout)


def run(coro):
    return asyncio.run(coro)


def test_delivers_to_every_subscriber():
    async def go():
        bus = MessageBus()
        got = []

        async def a(p): got.append(("a", p["n"]))
        async def b(p): got.append(("b", p["n"]))

        bus.subscribe("t", a)
        bus.subscribe("t", b)
        await bus.start()
        assert await bus.publish("t", {"n": 1})
        await _settle(bus)
        await bus.stop()
        assert sorted(got) == [("a", 1), ("b", 1)]

    run(go())


def test_retries_then_succeeds():
    async def go():
        bus = MessageBus(backoff_base=0.01, max_attempts=3)
        calls = []

        async def flaky(p):
            calls.append(1)
            if len(calls) < 3:
                raise RuntimeError("boom")

        bus.subscribe("t", flaky)
        await bus.start()
        await bus.publish("t", {})
        for _ in range(100):
            if len(calls) == 3:
                break
            await asyncio.sleep(0.02)
        await bus.stop()
        assert len(calls) == 3
        assert bus.stats()["retried"] == 2 and bus.stats()["dead"] == 0

    run(go())


def test_dead_letters_after_max_attempts():
    async def go():
        bus = MessageBus(backoff_base=0.01, max_attempts=2)

        async def always_fails(p):
            raise ValueError("nope")

        bus.subscribe("t", always_fails)
        await bus.start()
        await bus.publish("t", {"x": 1})
        for _ in range(100):
            if bus.dead_letters:
                break
            await asyncio.sleep(0.02)
        await bus.stop()
        assert len(bus.dead_letters) == 1
        assert bus.dead_letters[0]["payload"] == {"x": 1}

    run(go())


def test_outbox_replays_unfinished_messages_after_restart():
    async def go():
        outbox = MemoryOutbox()

        # first "process": message is saved but the bus never starts, so it stays unfinished
        bus1 = MessageBus(outbox=outbox)
        async def h1(p): pass
        bus1.subscribe("t", h1)
        await bus1.publish("t", {"n": 7})
        assert [r["done"] for r in outbox.rows.values()] == [False]

        # second "process": start() replays it and marks it done
        seen = []
        bus2 = MessageBus(outbox=outbox)
        async def h2(p): seen.append(p["n"])
        bus2.subscribe("t", h2)
        await bus2.start()
        await _settle(bus2)
        await bus2.stop()
        assert seen == [7]
        assert [r["done"] for r in outbox.rows.values()] == [True]

    run(go())


def test_publish_without_subscribers_and_full_queue_never_raise():
    async def go():
        bus = MessageBus(queue_size=1)
        assert await bus.publish("nobody", {})          # no subscribers: ok

        gate = asyncio.Event()
        async def slow(p): await gate.wait()
        bus.subscribe("t", slow)
        await bus.start()
        for i in range(5):                              # overflows the 1-slot queue
            assert await bus.publish("t", {"i": i})
        assert bus.stats()["dropped"] >= 1
        gate.set()
        await bus.stop(timeout=2)

    run(go())
