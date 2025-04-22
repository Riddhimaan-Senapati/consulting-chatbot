# test_main.py
import pytest
from fastapi.testclient import TestClient
import main

client = TestClient(main.app)


@pytest.fixture(autouse=True)
def patch_analysis_chain(monkeypatch):
    """
    Stub out the real analysis_chain.invoke() to always return a fixed result.
    """
    fake = {
        "messages": [
            ("system", "Start"),
            ("user", "Hello"),
            ("assistant", "Hi there! [source]")
        ]
    }
    monkeypatch.setattr(main.analysis_chain, "invoke", lambda state: fake)
    yield


class DummyCollection:
    """
    In‑memory stand‑in for a MongoDB collection.
    """
    def __init__(self):
        self._store = {}

    async def insert_one(self, doc: dict):
        new_id = __import__("bson").ObjectId()
        doc["_id"] = new_id
        self._store[new_id] = doc
        return type("R", (), {"inserted_id": new_id})()

    async def find_one(self, filter=None, sort=None):
        # Return the most recent if sort is used
        if sort:
            return max(self._store.values(), key=lambda d: d["_id"], default=None)
        # Return by specific _id
        if filter and "_id" in filter:
            return self._store.get(filter["_id"])
        return None


@pytest.fixture(autouse=True)
def patch_db(monkeypatch):
    """
    Replace main.discussion_collection with our DummyCollection instance.
    """
    dummy = DummyCollection()
    monkeypatch.setattr(main, "discussion_collection", dummy)
    yield


def test_health_check():
    """
    GET / → 200 + correct JSON payload.
    """
    r = client.get("/")
    assert r.status_code == 200
    assert r.json() == {"status": "active", "version": "1.0.0"}


def test_analyze_valid():
    """
    POST /analyze/ should:
      - store the chat,
      - return a JSON with "_id" == None,
      - return "response" matching our fake invoke,
      - and append the assistant message to "full_history".
    """
    payload = {
        "messages": [("system", "Start"), ("user", "Hello")],
        "user_input": "How are you?"
    }
    r = client.post("/analyze/", json=payload)
    assert r.status_code == 200

    data = r.json()
    # 1) The alias "_id" is present but remains None
    assert "_id" in data and data["_id"] is None  # expecting None per default behavior :contentReference[oaicite:4]{index=4}
    # 2) The response matches our stubbed invoke
    assert data["response"] == "Hi there! [source]"
    # 3) The last entry in full_history pairs the user_input with the assistant reply
    assert data["full_history"][-1] == ["How are you?", "Hi there! [source]"]


def test_analyze_invalid():
    """
    POST /analyze/ with a malformed payload → 422 Unprocessable Entity.
    """
    bad = {
        "messages": "not a list of tuples",
        "user_input": "Test"
    }
    r = client.post("/analyze/", json=bad)
    assert r.status_code == 422


def test_download_pdf_success():
    """
    After at least one analyze(), GET /download/?format=pdf returns a valid PDF.
    """
    # Seed the dummy DB
    client.post("/analyze/", json={
        "messages": [("system", "S"), ("user", "U")],
        "user_input": "Q"
    })

    r = client.get("/download/?format=pdf")
    assert r.status_code == 200
    # PDF files begin with the "%PDF" magic header
    assert r.content.startswith(b"%PDF")


def test_download_missing(monkeypatch):
    """
    If the DB is empty, overriding find_one() to return None → error JSON.
    """
    async def no_doc(*args, **kwargs):
        return None

    monkeypatch.setattr(main.discussion_collection, "find_one", no_doc)

    r = client.get("/download/?format=pdf")
    assert r.status_code == 200
    assert r.json() == {"error": "Report not found"}
