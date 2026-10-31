from datetime import timedelta
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.models import (
    Criterion,
    CriterionResult,
    Rubric,
    Run,
    StudentResult,
    StudentStatus,
    Submission,
    utcnow,
)
from app.storage import NotFoundError, Storage


def make_rubric(title: str = "Essay rubric") -> Rubric:
    return Rubric(
        title=title,
        criteria=[
            Criterion(name="Argument", max_points=10, description="Clear thesis"),
            Criterion(name="Evidence", max_points=15),
        ],
    )


def make_run() -> Run:
    return Run(
        rubric=make_rubric(),
        submissions=[
            Submission(student_id="asha", student_name="Asha", filename="asha.pdf"),
            Submission(student_id="ravi", student_name="Ravi", filename="ravi.docx"),
        ],
    )


@pytest.fixture
def storage(tmp_path: Path) -> Storage:
    return Storage(tmp_path)


def test_rubric_validation() -> None:
    rubric = make_rubric()
    assert rubric.max_total == 25
    with pytest.raises(ValidationError):
        Rubric(title="x", criteria=[])
    duplicates = [Criterion(name="Style", max_points=5), Criterion(name=" style", max_points=5)]
    with pytest.raises(ValidationError):
        Rubric(title="x", criteria=duplicates)


def test_rubric_round_trip(storage: Storage) -> None:
    older = make_rubric("Older")
    older.created_at = utcnow() - timedelta(days=1)
    newer = make_rubric("Newer")
    storage.save_rubric(older)
    storage.save_rubric(newer)

    assert storage.load_rubric(newer.id) == newer
    assert [r.title for r in storage.list_rubrics()] == ["Newer", "Older"]


def test_run_round_trip(storage: Storage) -> None:
    assert storage.list_runs() == []
    run = make_run()
    storage.save_run(run)
    assert storage.load_run(run.id) == run
    assert [r.id for r in storage.list_runs()] == [run.id]


def test_results_follow_submission_order(storage: Storage) -> None:
    run = make_run()
    storage.save_run(run)
    ravi = StudentResult(
        student_id="ravi",
        student_name="Ravi",
        status=StudentStatus.done,
        max_total=25,
        total=18,
        criteria=[
            CriterionResult(
                criterion="Argument", max_points=10, score=8, justification="Solid thesis"
            )
        ],
    )
    asha = StudentResult(student_id="asha", student_name="Asha", max_total=25)
    storage.save_result(run.id, ravi)
    storage.save_result(run.id, asha)

    assert storage.load_result(run.id, "ravi") == ravi
    assert [r.student_id for r in storage.load_results(run.id)] == ["asha", "ravi"]


def test_missing_items(storage: Storage) -> None:
    run = make_run()
    storage.save_run(run)
    assert storage.load_result(run.id, "asha") is None
    with pytest.raises(NotFoundError):
        storage.load_run("abc123")
    with pytest.raises(NotFoundError):
        storage.load_rubric("abc123")
    with pytest.raises(NotFoundError):
        storage.load_submission_text(run.id, "asha")


def test_submission_text_and_original(storage: Storage, tmp_path: Path) -> None:
    run = make_run()
    storage.save_submission_text(run.id, "asha", "My essay text.")
    assert storage.load_submission_text(run.id, "asha") == "My essay text."

    path = storage.save_original(run.id, "asha", "../../Essay Final.PDF", b"%PDF")
    assert path == tmp_path / "runs" / run.id / "originals" / "asha.pdf"
    assert path.read_bytes() == b"%PDF"


@pytest.mark.parametrize("bad_id", ["../etc", "a/b", "", "x" * 81, "run id"])
def test_unsafe_ids_rejected(storage: Storage, bad_id: str) -> None:
    with pytest.raises(ValueError):
        storage.load_run(bad_id)
