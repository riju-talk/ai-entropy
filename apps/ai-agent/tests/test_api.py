"""HTTP-level checks: service-token auth, validation, error mapping, flashcards parsing.
No network: the LLM call is monkeypatched."""
import os
import pathlib
import sys

os.environ["AI_BACKEND_TOKEN"] = "test-token"
os.environ["DEBUG"] = "false"
os.environ.pop("GROQ_API_KEY", None)
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

client = TestClient(app)
AUTH = {"X-Internal-Token": "test-token", "X-User-Id": "user-1"}


def test_health_is_public():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["embedding_model"]


def test_api_requires_service_token():
    assert client.post("/api/flashcards/", json={"topic": "x"}).status_code == 401
    bad = client.post("/api/flashcards/", json={"topic": "x"}, headers={"X-Internal-Token": "nope"})
    assert bad.status_code == 401


def test_validation_errors_are_422():
    r = client.post("/api/flashcards/", json={"topic": "", "count": 999}, headers=AUTH)
    assert r.status_code == 422


def test_missing_groq_key_is_503_not_500(monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "GROQ_API_KEY", "")  # a developer's real key in .env must not leak into this test
    r = client.post("/api/flashcards/", json={"topic": "photosynthesis", "count": 3}, headers=AUTH)
    assert r.status_code == 503


def test_flashcards_filters_malformed_cards(monkeypatch):
    from app.api.routes import flashcards

    async def fake(prompt, system_prompt=""):
        return {"flashcards": [{"front": "Q1", "back": "A1"}, {"front": "", "back": "x"}, "junk", {"front": "Q2"}]}

    monkeypatch.setattr(flashcards, "generate_json", fake)
    r = client.post("/api/flashcards/", json={"topic": "t", "count": 5}, headers=AUTH)
    assert r.status_code == 200
    assert r.json() == {"flashcards": [{"front": "Q1", "back": "A1"}]}


def test_flashcards_empty_model_output_is_502(monkeypatch):
    from app.api.routes import flashcards

    async def fake(prompt, system_prompt=""):
        return {}

    monkeypatch.setattr(flashcards, "generate_json", fake)
    assert client.post("/api/flashcards/", json={"topic": "t"}, headers=AUTH).status_code == 502


def test_rate_limit_keys_on_forwarded_user_not_ip(monkeypatch):
    from app.api.routes import flashcards

    async def fake(prompt, system_prompt=""):  # never touch the network, whatever key a developer has in .env
        return {"flashcards": [{"front": "Q", "back": "A"}]}

    monkeypatch.setattr(flashcards, "generate_json", fake)
    # user-1 exhausts their own budget on a limited route...
    codes = [client.post("/api/flashcards/", json={"topic": "x"}, headers={**AUTH, "X-User-Id": "rl-user-1"}).status_code for _ in range(12)]
    assert codes[-1] == 429 and 429 not in codes[:10]
    # ...while another user behind the same proxy IP is unaffected
    other = client.post("/api/flashcards/", json={"topic": "x"}, headers={**AUTH, "X-User-Id": "rl-user-2"})
    assert other.status_code != 429

