# test_main.py
import pytest
from fastapi.testclient import TestClient  # HTTPX-based testing client for FastAPI
import main
from bson import ObjectId
from passlib.context import CryptContext  # for verifying hashed passwords
from datetime import datetime

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

class AsyncIterator:
    """Helper class to mock async iteration."""
    def __init__(self, data):
        self.data = data
        self.index = 0
    def __aiter__(self):
        return self
    async def __anext__(self):
        if self.index < len(self.data):
            result = self.data[self.index]
            self.index += 1
            return result
        else:
            raise StopAsyncIteration

class DummyCursor:
    """Mocks a Motor cursor, primarily to provide a sort() method."""
    def __init__(self, items_future):
        self._items_future = items_future # This will be a list of items from the store
        self._sort_params = None

    def sort(self, key_or_list, direction=None):
        if isinstance(key_or_list, list):
            self._sort_params = key_or_list
        else:
            self._sort_params = [(key_or_list, direction)]
        return self # Allow chaining like cursor.sort().limit() if needed later
    
    def __aiter__(self):
        # Apply sorting when iteration starts
        items = list(self._items_future) # Get actual items
        if self._sort_params:
            for key, direction_val in reversed(self._sort_params): # motor applies sorts in reverse order of calls
                items.sort(key=lambda x: x.get(key, datetime.min if isinstance(x.get(key), datetime) else float('-inf')), 
                           reverse=direction_val == -1)
        return AsyncIterator(items)

class DummyCollection:
    """
    In‑memory stand‑in for a Motor collection.
    Supports insert_one and find_one(filter or sort).
    Also supports find, update_one, delete_one for plans.
    """
    def __init__(self):
        self._store = {}
    async def insert_one(self, doc):
        _id = ObjectId()
        doc["_id"] = _id
        # For plans, ensure created_at and updated_at are set if not present (though API should do this)
        if "created_at" not in doc:
            doc["created_at"] = datetime.utcnow()
        if "updated_at" not in doc:
            doc["updated_at"] = datetime.utcnow()
        self._store[_id] = doc
        return type("R",(),{"inserted_id":_id})()
    
    async def find_one(self, filter=None, sort=None):
        # sort => return latest, else filter by arbitrary fields :contentReference[oaicite:2]{index=2}
        if sort:
            # Ensure values have _id before sorting if that's the key
            valid_items = [d for d in self._store.values() if "_id" in d]
            return max(valid_items, key=lambda d: d["_id"], default=None)
        if filter:
            # match on any field
            for doc in self._store.values():
                if all(doc.get(k)==v for k,v in filter.items()):
                    return doc
        return None
    
    def find(self, filter=None): # filter is not used in current get_all_plans but good to have
        # Returns a DummyCursor which can then be sorted and iterated
        items_in_store = list(self._store.values())
        if filter: # Basic filtering for find()
            filtered_items = []
            for doc in items_in_store:
                if all(doc.get(k) == v for k, v in filter.items()):
                    filtered_items.append(doc)
            return DummyCursor(filtered_items)
        return DummyCursor(items_in_store)

    async def update_one(self, filter, update):
        updated_count = 0
        for _id, doc in self._store.items():
            if filter.get("_id") == _id:
                set_data = update.get("$set", {})
                for k, v in set_data.items():
                    doc[k] = v
                updated_count = 1
                break
        return type("UpdateResult", (), {"matched_count": updated_count, "modified_count": updated_count})()

    async def delete_one(self, filter):
        _id_to_delete = filter.get("_id")
        if _id_to_delete in self._store:
            del self._store[_id_to_delete]
            return type("DeleteResult", (), {"deleted_count": 1})()
        return type("DeleteResult", (), {"deleted_count": 0})()

@pytest.fixture(autouse=True)
def patch_dbs(monkeypatch):
    """
    Replace discussion_collection, user_collection, and plans_collection with DummyCollection.
    """
    dummy_discussion = DummyCollection()
    dummy_user = DummyCollection()
    dummy_plans = DummyCollection() # For plans
    monkeypatch.setattr(main, "discussion_collection", dummy_discussion)
    monkeypatch.setattr(main, "user_collection", dummy_user)
    monkeypatch.setattr(main, "plans_collection", dummy_plans) # Patch plans_collection
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
    assert r.status_code==422  # validation error :contentReference[oaicite:1]{index=1}

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
    assert ctx.verify("secret123",stored)  # password matches hash :contentReference[oaicite:0]{index=0}
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
    assert r.status_code==404  # HTTPException raised

def test_login_wrong_password():
    """Login with bad password → 400 HTTPException."""
    creds={"email":"u@v.com","password":"pw1"}
    client.post("/auth/signup",json=creds)
    r=client.post("/auth/login",json={"email":creds["email"],"password":"wrong"})
    assert r.status_code==400  # incorrect password branch

# --- Tests for Plans CRUD --- 

def test_create_plan_valid():
    """POST /plans/ with valid data should create a plan."""
    payload = {"title": "Test Plan 1", "description": "Description for plan 1", "status": "todo"}
    response = client.post("/plans/", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == payload["title"]
    assert data["description"] == payload["description"]
    assert data["status"] == payload["status"]
    assert "_id" in data
    assert "created_at" in data
    assert "updated_at" in data

def test_create_plan_invalid_payload():
    """POST /plans/ with missing fields should return 422."""
    payload = {"title": "Test Plan Incomplete"} # Missing description and status
    response = client.post("/plans/", json=payload)
    assert response.status_code == 422

def test_get_all_plans_empty():
    """GET /plans/ should return an empty list when no plans exist."""
    response = client.get("/plans/")
    assert response.status_code == 200
    assert response.json() == []

def test_get_all_plans_with_data():
    """GET /plans/ should return a list of plans."""
    plan1_payload = {"title": "Plan A", "description": "Desc A", "status": "todo"}
    # Simulate a slightly earlier creation time for the first plan for consistent sort order
    main.plans_collection._store[ObjectId()] = {**plan1_payload, "_id": ObjectId(), "created_at": datetime(2023, 1, 1, 10, 0, 0), "updated_at": datetime(2023, 1, 1, 10, 0, 0)}
    
    plan2_payload = {"title": "Plan B", "description": "Desc B", "status": "inprogress"}
    # Simulate a later creation time for the second plan
    main.plans_collection._store[ObjectId()] = {**plan2_payload, "_id": ObjectId(), "created_at": datetime(2023, 1, 1, 12, 0, 0), "updated_at": datetime(2023, 1, 1, 12, 0, 0)}

    response = client.get("/plans/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    # Plans are sorted by created_at descending, so Plan B should be first
    assert data[0]["title"] == "Plan B"
    assert data[1]["title"] == "Plan A"

def test_get_plan_valid():
    """GET /plans/{plan_id} should return the specific plan."""
    payload = {"title": "Specific Plan", "description": "Details", "status": "done"}
    create_response = client.post("/plans/", json=payload)
    plan_id = create_response.json()["_id"]

    response = client.get(f"/plans/{plan_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["_id"] == plan_id
    assert data["title"] == payload["title"]

def test_get_plan_not_found():
    """GET /plans/{plan_id} for a non-existent ID should return 404."""
    non_existent_id = str(ObjectId()) # Generate a valid but non-existent ObjectId string
    response = client.get(f"/plans/{non_existent_id}")
    assert response.status_code == 404
    assert response.json() == {"detail": f"Plan with id {non_existent_id} not found"}

def test_get_plan_invalid_id_format():
    """GET /plans/{plan_id} with a malformed ID should return 400."""
    response = client.get("/plans/invalid-id-format")
    assert response.status_code == 400
    assert response.json() == {"detail": "Invalid Plan ID format"}

def test_update_plan_valid():
    """PUT /plans/{plan_id} with valid data should update the plan."""
    initial_payload = {"title": "Old Title", "description": "Old Desc", "status": "todo"}
    create_response = client.post("/plans/", json=initial_payload)
    plan_id = create_response.json()["_id"]
    original_updated_at = create_response.json()["updated_at"]

    update_payload = {"title": "New Title", "status": "inprogress"}
    response = client.put(f"/plans/{plan_id}", json=update_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["_id"] == plan_id
    assert data["title"] == "New Title"
    assert data["description"] == "Old Desc" # Description should remain unchanged
    assert data["status"] == "inprogress"
    assert data["updated_at"] != original_updated_at

def test_update_plan_not_found():
    """PUT /plans/{plan_id} for a non-existent ID should return 404."""
    non_existent_id = str(ObjectId())
    update_payload = {"title": "Update Fail"}
    response = client.put(f"/plans/{non_existent_id}", json=update_payload)
    assert response.status_code == 404

def test_update_plan_invalid_id_format():
    """PUT /plans/{plan_id} with a malformed ID should return 400."""
    response = client.put("/plans/invalid-id", json={"title": "Update Fail"})
    assert response.status_code == 400

def test_update_plan_no_data():
    """PUT /plans/{plan_id} with an empty payload should return 400."""
    initial_payload = {"title": "Plan To Update", "description": "Desc", "status": "todo"}
    create_response = client.post("/plans/", json=initial_payload)
    plan_id = create_response.json()["_id"]
    response = client.put(f"/plans/{plan_id}", json={})
    assert response.status_code == 400
    assert response.json() == {"detail": "No update data provided"}

def test_delete_plan_valid():
    """DELETE /plans/{plan_id} should delete the plan."""
    payload = {"title": "To Be Deleted", "description": "Bye", "status": "todo"}
    create_response = client.post("/plans/", json=payload)
    plan_id = create_response.json()["_id"]

    delete_response = client.delete(f"/plans/{plan_id}")
    assert delete_response.status_code == 200
    assert delete_response.json() == {"message": f"Plan {plan_id} deleted successfully"}

    # Verify plan is actually deleted
    get_response = client.get(f"/plans/{plan_id}")
    assert get_response.status_code == 404

def test_delete_plan_not_found():
    """DELETE /plans/{plan_id} for a non-existent ID should return 404."""
    non_existent_id = str(ObjectId())
    response = client.delete(f"/plans/{non_existent_id}")
    assert response.status_code == 404

def test_delete_plan_invalid_id_format():
    """DELETE /plans/{plan_id} with a malformed ID should return 400."""
    response = client.delete("/plans/invalid-id-format")
    assert response.status_code == 400
