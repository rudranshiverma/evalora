import base64
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.grader import MockBackend
from app.main import create_app

PASSWORD = "correct-horse-battery"
RUBRIC = {"title": "Essay", "criteria": [{"name": "Argument", "max_points": 5}]}
ESSAY = b"Solar power is now the cheapest source of new electricity in many countries today."


def make_client(tmp_path: Path, password: str = PASSWORD) -> TestClient:
    settings = Settings(
        gemini_api_key="",
        model="gemini-flash-latest",
        use_mock_grader=True,
        max_concurrency=1,
        data_dir=tmp_path,
        username="teacher",
        password=password,
    )
    app = create_app(settings, backend_factory=lambda: MockBackend(delay=0))
    return TestClient(app)


def basic(username: str, password: str) -> dict[str, str]:
    token = base64.b64encode(f"{username}:{password}".encode()).decode()
    return {"Authorization": f"Basic {token}"}


def test_requests_without_credentials_are_refused(tmp_path: Path) -> None:
    with make_client(tmp_path) as client:
        response = client.get("/api/health")
    assert response.status_code == 401
    assert response.headers["www-authenticate"].startswith("Basic")


@pytest.mark.parametrize(
    "headers",
    [
        basic("teacher", "wrong"),
        basic("someone", PASSWORD),
        {"Authorization": "Basic not-base64!"},
        {"Authorization": f"Bearer {PASSWORD}"},
    ],
)
def test_wrong_credentials_are_refused(tmp_path: Path, headers: dict[str, str]) -> None:
    with make_client(tmp_path) as client:
        assert client.get("/api/runs", headers=headers).status_code == 401


def test_health_check_stays_open(tmp_path: Path) -> None:
    with make_client(tmp_path) as client:
        response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_no_password_means_no_sign_in(tmp_path: Path) -> None:
    with make_client(tmp_path, password="") as client:
        assert client.get("/api/health").status_code == 200


def test_signed_in_user_can_grade_and_stream(tmp_path: Path) -> None:
    headers = basic("teacher", PASSWORD)
    with make_client(tmp_path) as client:
        created = client.post(
            "/api/runs",
            data={"rubric": json.dumps(RUBRIC)},
            files=[("files", ("asha.txt", ESSAY, "text/plain"))],
            headers=headers,
        )
        assert created.status_code == 201
        run_id = created.json()["run"]["id"]
        assert client.post(f"/api/runs/{run_id}/start", headers=headers).status_code == 202

        events = []
        with client.stream("GET", f"/api/runs/{run_id}/stream", headers=headers) as response:
            for line in response.iter_lines():
                if line.startswith("event: "):
                    events.append(line.removeprefix("event: "))
                    if events[-1] == "run_done":
                        break
        assert events[0] == "snapshot"
        assert events[-1] == "run_done"
