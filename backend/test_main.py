from fastapi.testclient import TestClient
from main import app  

client = TestClient(app)

#This test checks whether the API is active or not, in other words a health check
def test_health_check():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"status": "active", "version": "1.0.0"}

#This test checks whether the analyze API route sends a valid response in response to valid input
def test_analyze_valid():
    request_data = {
        "messages": [("system", "Hello"), ("user", "Hi")],
        "user_input": "How are you?"
    }
    response = client.post("/analyze", json=request_data)
    assert response.status_code == 200
    assert "response" in response.json()
    assert "full_history" in response.json()

#This test checks whether the analyze API route sends a status code of 422(an error) response in response to invalid input
def test_analyze_invalid():
    request_data = {
        "messages": "invalid_format",  # Invalid format; should be a list of tuples
        "user_input": "How are you?"
    }
    response = client.post("/analyze", json=request_data)
    assert response.status_code == 422

