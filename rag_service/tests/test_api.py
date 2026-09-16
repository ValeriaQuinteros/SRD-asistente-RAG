from fastapi.testclient import TestClient

from src.main import app


client = TestClient(app)


def test_health_does_not_initialize_models():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_chat_requires_authentication():
    response = client.post("/api/chat", json={"question": "¿Cómo hago el ejercicio?"})
    assert response.status_code == 401
