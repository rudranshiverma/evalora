import os
import re
from pathlib import Path
from typing import TypeVar
from uuid import uuid4

from pydantic import BaseModel

from app.models import Rubric, Run, StudentResult

M = TypeVar("M", bound=BaseModel)

_SAFE_ID = re.compile(r"^[A-Za-z0-9_-]{1,80}$")


class NotFoundError(Exception):
    pass


class InvalidIdError(ValueError):
    pass


def check_id(value: str) -> str:
    if not _SAFE_ID.match(value):
        raise InvalidIdError(f"invalid id: {value!r}")
    return value


def _write_json(path: Path, model: BaseModel) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.name}.{uuid4().hex}.tmp")
    tmp.write_text(model.model_dump_json(indent=2), encoding="utf-8")
    os.replace(tmp, path)


def _read_json(path: Path, model_cls: type[M], label: str) -> M:
    if not path.exists():
        raise NotFoundError(f"{label} not found")
    return model_cls.model_validate_json(path.read_text(encoding="utf-8"))


class Storage:
    def __init__(self, root: Path):
        self.root = root
        self.rubrics_dir = root / "rubrics"
        self.runs_dir = root / "runs"

    def _run_dir(self, run_id: str) -> Path:
        return self.runs_dir / check_id(run_id)

    def save_rubric(self, rubric: Rubric) -> None:
        _write_json(self.rubrics_dir / f"{check_id(rubric.id)}.json", rubric)

    def load_rubric(self, rubric_id: str) -> Rubric:
        path = self.rubrics_dir / f"{check_id(rubric_id)}.json"
        return _read_json(path, Rubric, f"rubric {rubric_id}")

    def list_rubrics(self) -> list[Rubric]:
        paths = self.rubrics_dir.glob("*.json") if self.rubrics_dir.exists() else []
        rubrics = [_read_json(p, Rubric, p.stem) for p in paths]
        return sorted(rubrics, key=lambda r: r.created_at, reverse=True)

    def save_run(self, run: Run) -> None:
        _write_json(self._run_dir(run.id) / "run.json", run)

    def load_run(self, run_id: str) -> Run:
        return _read_json(self._run_dir(run_id) / "run.json", Run, f"run {run_id}")

    def list_runs(self) -> list[Run]:
        paths = self.runs_dir.glob("*/run.json") if self.runs_dir.exists() else []
        runs = [_read_json(p, Run, p.parent.name) for p in paths]
        return sorted(runs, key=lambda r: r.created_at, reverse=True)

    def save_original(self, run_id: str, student_id: str, filename: str, data: bytes) -> Path:
        suffix = Path(filename).suffix.lower()
        if not re.fullmatch(r"\.[a-z0-9]{1,8}", suffix):
            suffix = ""
        path = self._run_dir(run_id) / "originals" / f"{check_id(student_id)}{suffix}"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return path

    def save_submission_text(self, run_id: str, student_id: str, text: str) -> None:
        path = self._run_dir(run_id) / "submissions" / f"{check_id(student_id)}.txt"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")

    def load_submission_text(self, run_id: str, student_id: str) -> str:
        path = self._run_dir(run_id) / "submissions" / f"{check_id(student_id)}.txt"
        if not path.exists():
            raise NotFoundError(f"submission {student_id} not found")
        return path.read_text(encoding="utf-8")

    def save_result(self, run_id: str, result: StudentResult) -> None:
        path = self._run_dir(run_id) / "results" / f"{check_id(result.student_id)}.json"
        _write_json(path, result)

    def load_result(self, run_id: str, student_id: str) -> StudentResult | None:
        path = self._run_dir(run_id) / "results" / f"{check_id(student_id)}.json"
        if not path.exists():
            return None
        return StudentResult.model_validate_json(path.read_text(encoding="utf-8"))

    def load_results(self, run_id: str) -> list[StudentResult]:
        run = self.load_run(run_id)
        results = (self.load_result(run_id, s.student_id) for s in run.submissions)
        return [r for r in results if r is not None]
