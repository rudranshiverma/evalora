import asyncio
import logging
from collections.abc import Callable

from app.grader import Backend, GradingError, grade_submission
from app.models import Run, RunStatus, StudentResult, StudentStatus, Submission, utcnow
from app.schemas import summarize
from app.storage import NotFoundError, Storage

logger = logging.getLogger("evalora")

PENDING = {StudentStatus.queued, StudentStatus.grading}

Event = tuple[str, dict]


class AlreadyGradingError(Exception):
    pass


class GradingManager:
    def __init__(
        self, storage: Storage, backend_factory: Callable[[], Backend], max_concurrency: int
    ):
        self.storage = storage
        self.backend_factory = backend_factory
        self.semaphore = asyncio.Semaphore(max_concurrency)
        self.tasks: dict[str, dict[str, asyncio.Task]] = {}
        self.subscribers: dict[str, set[asyncio.Queue[Event]]] = {}
        self._backend: Backend | None = None

    def backend(self) -> Backend:
        if self._backend is None:
            self._backend = self.backend_factory()
        return self._backend

    def is_active(self, run_id: str) -> bool:
        return bool(self.tasks.get(run_id))

    def recover(self) -> None:
        for run in self.storage.list_runs():
            if run.status != RunStatus.running:
                continue
            for result in self.storage.load_results(run.id):
                if result.status == StudentStatus.grading:
                    result.status = StudentStatus.queued
                    self.storage.save_result(run.id, result)
            run.status = RunStatus.ready
            self.storage.save_run(run)

    async def shutdown(self) -> None:
        tasks = [t for run_tasks in self.tasks.values() for t in run_tasks.values()]
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)

    def start(self, run_id: str) -> None:
        run = self.storage.load_run(run_id)
        backend = self.backend()
        results = {r.student_id: r for r in self.storage.load_results(run_id)}
        scheduled = self.tasks.setdefault(run_id, {})
        pending = [
            s
            for s in run.submissions
            if s.student_id not in scheduled
            and (s.student_id not in results or results[s.student_id].status in PENDING)
        ]
        if not pending and not scheduled:
            self.tasks.pop(run_id, None)
            self._finish(run_id)
            return
        run.status = RunStatus.running
        run.model = backend.model
        run.started_at = run.started_at or utcnow()
        run.finished_at = None
        self.storage.save_run(run)
        for submission in pending:
            task = asyncio.create_task(self._grade_one(run, submission, backend))
            scheduled[submission.student_id] = task

    def retry(self, run_id: str, student_id: str) -> None:
        run = self.storage.load_run(run_id)
        submission = find_submission(run, student_id)
        if student_id in self.tasks.get(run_id, {}):
            raise AlreadyGradingError(f"{submission.student_name} is already being graded")
        self.backend()
        self._save(run_id, new_result(run, submission))
        self.start(run_id)

    def subscribe(self, run_id: str) -> asyncio.Queue[Event]:
        queue: asyncio.Queue[Event] = asyncio.Queue()
        self.subscribers.setdefault(run_id, set()).add(queue)
        return queue

    def unsubscribe(self, run_id: str, queue: asyncio.Queue[Event]) -> None:
        queues = self.subscribers.get(run_id)
        if queues is not None:
            queues.discard(queue)
            if not queues:
                del self.subscribers[run_id]

    def _publish(self, run_id: str, event: str, data: dict) -> None:
        for queue in self.subscribers.get(run_id, ()):
            queue.put_nowait((event, data))

    def _save(self, run_id: str, result: StudentResult) -> None:
        self.storage.save_result(run_id, result)
        self._publish(run_id, "student", result.model_dump(mode="json"))

    def _finish(self, run_id: str) -> None:
        run = self.storage.load_run(run_id)
        run.status = RunStatus.completed
        run.finished_at = utcnow()
        self.storage.save_run(run)
        summary = summarize(run, self.storage.load_results(run_id))
        self._publish(run_id, "run_done", summary.model_dump(mode="json"))

    async def _grade_one(self, run: Run, submission: Submission, backend: Backend) -> None:
        cancelled = False
        try:
            async with self.semaphore:
                self._save(run.id, new_result(run, submission, StudentStatus.grading))
                text = self.storage.load_submission_text(run.id, submission.student_id)
                if not text.strip():
                    message = submission.warning or "No readable text to grade."
                    result = failed_result(run, submission, message, backend.model)
                else:
                    try:
                        result = await grade_submission(backend, run.rubric, submission, text)
                    except GradingError as e:
                        result = failed_result(run, submission, str(e), backend.model)
                self._save(run.id, result)
        except asyncio.CancelledError:
            cancelled = True
            raise
        except Exception:
            logger.exception("Grading %s/%s crashed", run.id, submission.student_id)
            message = "Unexpected error while grading. Check the server log."
            self._save(run.id, failed_result(run, submission, message, backend.model))
        finally:
            run_tasks = self.tasks.get(run.id, {})
            run_tasks.pop(submission.student_id, None)
            if not run_tasks and not cancelled:
                self.tasks.pop(run.id, None)
                self._finish(run.id)


def find_submission(run: Run, student_id: str) -> Submission:
    for submission in run.submissions:
        if submission.student_id == student_id:
            return submission
    raise NotFoundError(f"student {student_id} not found")


def new_result(
    run: Run, submission: Submission, status: StudentStatus = StudentStatus.queued
) -> StudentResult:
    return StudentResult(
        student_id=submission.student_id,
        student_name=submission.student_name,
        status=status,
        max_total=run.rubric.max_total,
    )


def failed_result(run: Run, submission: Submission, error: str, model: str) -> StudentResult:
    result = new_result(run, submission, StudentStatus.failed)
    result.error = error
    result.model = model
    result.graded_at = utcnow()
    return result
