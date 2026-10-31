import csv
import io
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.grader import MockBackend
from app.main import create_app
from app.models import Criterion, Rubric, Run, RunStatus, StudentResult, StudentStatus, Submission
from app.storage import Storage

ESSAY_A = (
    "Solar power is now the cheapest source of new electricity in India. "
    "Costs fell by almost 80 percent in a decade, according to the IEA. "
    "However, storage remains the main barrier to reliable supply at night. "
    "Grid scale batteries and pumped hydro are the most promising answers so far."
)
ESSAY_B = (
    "Coal still provides most of India's electricity and employs millions of workers. "
    "A fast transition without retraining would hurt communities in Jharkhand and Odisha. "
    "The government should pair new solar targets with a clear plan for coal regions."
)

RUBRIC = {
    "title": "Energy essay",
    "assignment_prompt": "Discuss India's energy transition.",
    "criteria": [
        {"name": "Argument", "max_points": 10, "description": "Clear thesis"},
        {"name": "Evidence", "max_points": 5, "description": "Uses facts"},
    ],
}


def settings(tmp_path: Path, **overrides) -> Settings:
    values = dict(
        gemini_api_key="",
        model="gemini-flash-latest",
        use_mock_grader=True,
        max_concurrency=2,
        data_dir=tmp_path,
    )
    values.update(overrides)
    return Settings(**values)


@pytest.fixture
def client(tmp_path: Path):
    app = create_app(settings(tmp_path), backend_factory=lambda: MockBackend(delay=0.2))
    with TestClient(app) as c:
        yield c


def upload(client: TestClient) -> dict:
    files = [
        ("files", ("asha_rao.txt", ESSAY_A.encode(), "text/plain")),
        ("files", ("ravi.txt", ESSAY_B.encode(), "text/plain")),
        ("files", ("photo.png", b"\x89PNG", "image/png")),
    ]
    response = client.post("/api/runs", data={"rubric": json.dumps(RUBRIC)}, files=files)
    assert response.status_code == 201, response.text
    return response.json()


def read_events(client: TestClient, run_id: str) -> list[tuple[str, dict]]:
    events = []
    name = ""
    with client.stream("GET", f"/api/runs/{run_id}/stream") as response:
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        for line in response.iter_lines():
            if line.startswith("event: "):
                name = line.removeprefix("event: ")
            elif line.startswith("data: "):
                events.append((name, json.loads(line.removeprefix("data: "))))
                if name == "run_done":
                    break
    return events


def test_health(client: TestClient) -> None:
    assert client.get("/api/health").json() == {
        "status": "ok",
        "mock_grader": True,
        "model": "mock",
        "api_key_set": False,
    }


def test_rubrics(client: TestClient) -> None:
    created = client.post("/api/rubrics", json={**RUBRIC, "id": "../../hack"})
    assert created.status_code == 201
    body = created.json()
    assert body["id"] != "../../hack"
    assert body["max_total"] == 15
    assert [r["id"] for r in client.get("/api/rubrics").json()] == [body["id"]]
    assert client.post("/api/rubrics", json={**RUBRIC, "criteria": []}).status_code == 422


def test_upload_creates_queued_run(client: TestClient, tmp_path: Path) -> None:
    detail = upload(client)
    run, results, summary = detail["run"], detail["results"], detail["summary"]
    subs = {s["student_id"]: s for s in run["submissions"]}

    assert list(subs) == ["asha-rao", "ravi", "photo"]
    assert subs["asha-rao"]["student_name"] == "Asha Rao"
    assert subs["asha-rao"]["warning"] is None
    assert "Unsupported file type .png" in subs["photo"]["warning"]
    assert {r["status"] for r in results} == {"queued"}
    assert summary["status"] == "ready"
    assert summary["pending"] == 3
    assert (tmp_path / "runs" / run["id"] / "originals" / "asha-rao.txt").exists()


def test_upload_rejects_bad_rubric(client: TestClient) -> None:
    files = [("files", ("a.txt", b"text", "text/plain"))]
    response = client.post("/api/runs", data={"rubric": "{}"}, files=files)
    assert response.status_code == 422


def test_full_grading_flow(client: TestClient, tmp_path: Path) -> None:
    run_id = upload(client)["run"]["id"]

    renamed = client.patch(f"/api/runs/{run_id}/students/ravi", json={"student_name": "Ravi K"})
    assert renamed.json()["student_name"] == "Ravi K"

    started = client.post(f"/api/runs/{run_id}/start")
    assert started.status_code == 202
    assert started.json()["status"] == "running"

    events = read_events(client, run_id)
    names = [name for name, _ in events]
    assert names[0] == "snapshot"
    assert names[-1] == "run_done"
    assert "student" in names

    detail = client.get(f"/api/runs/{run_id}").json()
    results = {r["student_id"]: r for r in detail["results"]}
    summary = detail["summary"]
    assert (summary["status"], summary["model"]) == ("completed", "mock")
    assert (summary["done"], summary["failed"], summary["pending"]) == (2, 1, 0)
    assert summary["average_total"] is not None
    assert results["ravi"]["student_name"] == "Ravi K"
    assert results["asha-rao"]["total"] == sum(c["score"] for c in results["asha-rao"]["criteria"])
    assert all(c["evidence_verified"] for c in results["asha-rao"]["criteria"])
    assert "Unsupported file type" in results["photo"]["error"]
    assert (tmp_path / "runs" / run_id / "results" / "ravi.json").exists()

    exported = client.get(f"/api/runs/{run_id}/export.csv")
    assert 'filename="evalora-energy-essay.csv"' in exported.headers["content-disposition"]
    rows = list(csv.reader(io.StringIO(exported.content.decode("utf-8-sig"))))
    assert rows[0][:4] == ["Student", "Status", "Argument (/10)", "Evidence (/5)"]
    assert [row[0] for row in rows[1:]] == ["Asha Rao", "Ravi K", "Photo"]

    report = client.get(f"/api/runs/{run_id}/students/asha-rao/report.md").text
    assert "# Asha Rao" in report
    assert "AI-assisted grading (mock" in report
    assert "## Argument:" in report

    retried = client.post(f"/api/runs/{run_id}/students/asha-rao/retry")
    assert retried.status_code == 202
    assert retried.json()["status"] == "queued"
    events = read_events(client, run_id)
    final = client.get(f"/api/runs/{run_id}").json()
    assert events[-1][0] == "run_done"
    assert final["summary"]["done"] == 2
    assert final["summary"]["status"] == "completed"


def test_runs_list(client: TestClient) -> None:
    run_id = upload(client)["run"]["id"]
    runs = client.get("/api/runs").json()
    assert [r["id"] for r in runs] == [run_id]
    assert runs[0]["title"] == "Energy essay"


def test_stream_of_idle_run_closes(client: TestClient) -> None:
    run_id = upload(client)["run"]["id"]
    events = read_events(client, run_id)
    assert [name for name, _ in events] == ["snapshot", "run_done"]
    assert events[-1][1]["status"] == "ready"


def test_not_found(client: TestClient) -> None:
    assert client.get("/api/runs/abc123").status_code == 404
    assert client.get("/api/runs/bad%20id").status_code == 404
    run_id = upload(client)["run"]["id"]
    assert client.post(f"/api/runs/{run_id}/students/nobody/retry").status_code == 404


def test_start_without_api_key(tmp_path: Path) -> None:
    app = create_app(settings(tmp_path, use_mock_grader=False))
    with TestClient(app) as client:
        run_id = upload(client)["run"]["id"]
        response = client.post(f"/api/runs/{run_id}/start")
    assert response.status_code == 400
    assert "GEMINI_API_KEY" in response.json()["detail"]


def test_serves_built_frontend(tmp_path: Path) -> None:
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text('<div id="root"></div>')
    (dist / "assets" / "app.js").write_text("console.log('evalora')")
    app = create_app(settings(tmp_path / "data"), frontend_dir=dist)
    with TestClient(app) as client:
        page = client.get("/")
        assert page.status_code == 200
        assert '<div id="root">' in page.text
        assert client.get("/assets/app.js").status_code == 200
        assert client.get("/api/health").status_code == 200


def test_explains_missing_frontend(tmp_path: Path) -> None:
    app = create_app(settings(tmp_path), frontend_dir=tmp_path / "missing")
    with TestClient(app) as client:
        response = client.get("/")
    assert response.status_code == 503
    assert "npm run build" in response.text


def test_interrupted_run_is_recovered(tmp_path: Path) -> None:
    storage = Storage(tmp_path)
    rubric = Rubric(title="R", criteria=[Criterion(name="A", max_points=5)])
    submission = Submission(student_id="asha", student_name="Asha", filename="a.txt")
    run = Run(rubric=rubric, submissions=[submission], status=RunStatus.running)
    storage.save_run(run)
    storage.save_submission_text(run.id, "asha", ESSAY_A)
    stuck = StudentResult(
        student_id="asha", student_name="Asha", status=StudentStatus.grading, max_total=5
    )
    storage.save_result(run.id, stuck)

    app = create_app(settings(tmp_path), backend_factory=lambda: MockBackend(delay=0))
    with TestClient(app) as client:
        detail = client.get(f"/api/runs/{run.id}").json()
        assert detail["summary"]["status"] == "ready"
        assert detail["results"][0]["status"] == "queued"
        client.post(f"/api/runs/{run.id}/start")
        read_events(client, run.id)
        assert client.get(f"/api/runs/{run.id}").json()["summary"]["done"] == 1
