from datetime import datetime, timezone
from enum import Enum
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, computed_field, model_validator


def new_id() -> str:
    return uuid4().hex[:12]


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Criterion(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=120)
    max_points: float = Field(gt=0)
    description: str = ""


class Rubric(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    id: str = Field(default_factory=new_id)
    title: str = Field(min_length=1, max_length=200)
    assignment_prompt: str = ""
    criteria: list[Criterion] = Field(min_length=1)
    created_at: datetime = Field(default_factory=utcnow)

    @model_validator(mode="after")
    def unique_criterion_names(self) -> "Rubric":
        names = [c.name.lower() for c in self.criteria]
        if len(names) != len(set(names)):
            raise ValueError("criterion names must be unique")
        return self

    @computed_field
    @property
    def max_total(self) -> float:
        return sum(c.max_points for c in self.criteria)


class StudentStatus(str, Enum):
    queued = "queued"
    grading = "grading"
    done = "done"
    failed = "failed"


class RunStatus(str, Enum):
    ready = "ready"
    running = "running"
    completed = "completed"


class Submission(BaseModel):
    student_id: str
    student_name: str
    filename: str
    word_count: int = 0
    warning: str | None = None


class CriterionResult(BaseModel):
    criterion: str
    max_points: float
    score: float = Field(ge=0)
    justification: str
    evidence_quote: str = ""
    evidence_verified: bool = False
    strengths: str = ""
    improvements: str = ""


class StudentResult(BaseModel):
    student_id: str
    student_name: str
    status: StudentStatus = StudentStatus.queued
    criteria: list[CriterionResult] = Field(default_factory=list)
    total: float | None = None
    max_total: float
    overall_feedback: str = ""
    flags: list[str] = Field(default_factory=list)
    confidence: float | None = None
    model: str | None = None
    graded_at: datetime | None = None
    error: str | None = None


class Run(BaseModel):
    id: str = Field(default_factory=new_id)
    rubric: Rubric
    submissions: list[Submission]
    status: RunStatus = RunStatus.ready
    model: str | None = None
    created_at: datetime = Field(default_factory=utcnow)
    started_at: datetime | None = None
    finished_at: datetime | None = None
