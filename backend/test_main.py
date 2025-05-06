# test_main.py
import pytest
from fastapi.testclient import TestClient  # HTTPX-based testing client for FastAPI
import main
from bson import ObjectId
from passlib.context import CryptContext  # for verifying hashed passwords

client = TestClient(main.app)

"""
This testing suite uses monkey patching where instead of a real database, we 
have created a fake one in order to not add any unnecessary information to our
database
"""
@pytest.fixture(autouse=True)
def patch_analysis_chain(monkeypatch):
    """
    Stub out the LLM workflow so analyze/ always returns a fixed assistant reply.
    """
    fake = {"messages":[("system","OK"),("user","X"),("assistant","Reply [src]")]}
    monkeypatch.setattr(main.analysis_chain, "invoke", lambda state: fake)
    yield

class DummyCollection:
    """
    In‑memory stand‑in for a Motor collection.
    Supports insert_one and find_one(filter or sort).
    """
    def __init__(self):
        self._store = {}
    async def insert_one(self, doc):
        _id = ObjectId()
        doc["_id"] = _id
        self._store[_id] = doc
        return type("R",(),{"inserted_id":_id})()
    async def find_one(self, filter=None, sort=None):
        # sort => return latest, else filter by arbitrary fields :contentReference[oaicite:2]{index=2}
        if sort:
            return max(self._store.values(), key=lambda d: d["_id"], default=None)
        if filter:
            # match on any field
            for doc in self._store.values():
                if all(doc.get(k)==v for k,v in filter.items()):
                    return doc
        return None

@pytest.fixture(autouse=True)
def patch_dbs(monkeypatch):
    """
    Replace both discussion_collection and user_collection with DummyCollection.
    """
    dummy1 = DummyCollection()
    dummy2 = DummyCollection()
    monkeypatch.setattr(main, "discussion_collection", dummy1)
    monkeypatch.setattr(main, "user_collection", dummy2)
    yield

# ─── Tests ────────────────────────────────────────────────────────────────────

def test_health_check():
    """GET / → 200 + expected JSON."""
    r = client.get("/") 
    assert r.status_code==200 
    assert r.json()=={"status":"active","version":"1.0.0"}  # health endpoint

def test_analyze_valid():
    """POST /analyze/ returns _id=None, stubbed response, and updated history."""
    payload={"messages":[("system","OK")], "user_input":"Hello"}
    r = client.post("/analyze/", json=payload)
    assert r.status_code==200
    d=r.json()
    assert "_id" in d and d["_id"] is None  # alias field remains None by default 
    assert d["response"]=="Reply [src]"  # stubbed assistant reply
    assert d["full_history"][-1]==["Hello","Reply [src]"]

def test_analyze_invalid():
    """Malformed payload → 422 Unprocessable Entity."""
    r=client.post("/analyze/",json={"messages":"bad","user_input":"x"})
    assert r.status_code==422  # validation error :contentReference[oaicite:5]{index=5}

def test_download_pdf_success():
    """After one analysis, GET /download/?format=pdf returns a PDF file."""
    client.post("/analyze/", json={"messages":[("s","1")],"user_input":"Q"})
    r=client.get("/download/?format=pdf")
    assert r.status_code==200
    assert r.content.startswith(b"%PDF")  # PDF magic header

def test_download_missing(monkeypatch):
    """Empty DB → error JSON."""
    async def no_doc(*a,**k): return None
    monkeypatch.setattr(main.discussion_collection, "find_one", no_doc)
    r=client.get("/download/?format=pdf")
    assert r.status_code==200
    assert r.json()=={"error":"Report not found"}

def test_signup_and_login_flow():
    """
    POST /auth/signup → success + hashed password stored;
    then POST /auth/login → success.
    """
    creds={"email":"a@b.com","password":"secret123"}
    # Signup
    r1=client.post("/auth/signup",json=creds)
    assert r1.status_code==200
    d1=r1.json()
    assert d1["message"]=="User created successfully"
    assert isinstance(d1["user_id"],str) and len(d1["user_id"])==24
    # Inspect stored hash
    stored=main.user_collection._store[ObjectId(d1["user_id"])]["password"]
    ctx=CryptContext(schemes=["bcrypt"],deprecated="auto")
    assert ctx.verify("secret123",stored)  # password matches hash :contentReference[oaicite:6]{index=6}
    # Login
    r2=client.post("/auth/login",json=creds)
    assert r2.status_code==200
    d2=r2.json()
    assert d2["message"]=="Login successful"
    assert d2["user_id"]==d1["user_id"]

def test_signup_existing():
    """Signing up same email twice → error message."""
    creds={"email":"dup@x.com","password":"p"}
    client.post("/auth/signup",json=creds)
    r=client.post("/auth/signup",json=creds)
    assert r.status_code==200
    assert r.json()=={"error":"User already exists"}  # handled as JSON error

def test_login_not_found():
    """Login with unknown email → 404 HTTPException."""
    r=client.post("/auth/login",json={"email":"no@one.com","password":"x"})
    assert r.status_code==404  # HTTPException raised :contentReference[oaicite:7]{index=7}

def test_login_wrong_password():
    """Login with bad password → 400 HTTPException."""
    creds={"email":"u@v.com","password":"pw1"}
    client.post("/auth/signup",json=creds)
    r=client.post("/auth/login",json={"email":creds["email"],"password":"wrong"})
    assert r.status_code==400  # incorrect password branch
