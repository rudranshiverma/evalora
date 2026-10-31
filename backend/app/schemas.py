from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models import Run, RunStatus, StudentResult, StudentStatus


class RunSummary(BaseModel):
    id: str
    title: str
    status: RunStatus
    model: str | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
    total: int
    done: int
    failed: int
    pending: int
    average_total: float | None
    max_total: float


class RunDetail(BaseModel):
    run: Run
    results: list[StudentResult]
    summary: RunSummary


class RenameIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    student_name: str = Field(min_length=1, max_length=120)


class Health(BaseModel):
    status: str
    mock_grader: bool
    model: str
    api_key_set: bool


def summarize(run: Run, results: list[StudentResult]) -> RunSummary:
    done = [r for r in results if r.status == StudentStatus.done]
    failed = sum(r.status == StudentStatus.failed for r in results)
    totals = [r.total for r in done if r.total is not None]
    return RunSummary(
        id=run.id,
        title=run.rubric.title,
        status=run.status,
        model=run.model,
        created_at=run.created_at,
        started_at=run.started_at,
        finished_at=run.finished_at,
        total=len(run.submissions),
        done=len(done),
        failed=failed,
        pending=len(run.submissions) - len(done) - failed,
        average_total=round(sum(totals) / len(totals), 2) if totals else None,
        max_total=run.rubric.max_total,
    )
