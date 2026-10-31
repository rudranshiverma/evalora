import asyncio
import json
import logging
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import (
    FileResponse,
    JSONResponse,
    PlainTextResponse,
    Response,
    StreamingResponse,
)
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError

from app.auth import BasicAuthMiddleware
from app.config import PROJECT_ROOT, Settings, load_settings
from app.grader import Backend, GradingError, make_backend
from app.ingest import Extracted, assign_student_ids, extract_text, student_name_from_filename
from app.models import Rubric, Run, StudentResult, Submission, new_id, utcnow
from app.reports import results_csv, student_report
from app.runner import AlreadyGradingError, GradingManager, find_submission, new_result
from app.schemas import Health, RenameIn, RunDetail, RunSummary, summarize
from app.storage import InvalidIdError, NotFoundError, Storage

MAX_FILES = 200
MAX_FILE_BYTES = 10 * 1024 * 1024
KEEPALIVE_SECONDS = 15
FRONTEND_DIR = PROJECT_ROOT / "frontend" / "dist"

logging.basicConfig(level=logging.INFO)


def sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def create_app(
    settings: Settings | None = None,
    backend_factory: Callable[[], Backend] | None = None,
    frontend_dir: Path = FRONTEND_DIR,
) -> FastAPI:
    settings = settings or load_settings()
    storage = Storage(settings.data_dir)
    manager = GradingManager(
        storage, backend_factory or (lambda: make_backend(settings)), settings.max_concurrency
    )

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        manager.recover()
        yield
        await manager.shutdown()

    app = FastAPI(title="Evalora", lifespan=lifespan)
    if settings.password:
        app.add_middleware(
            BasicAuthMiddleware, username=settings.username, password=settings.password
        )

    @app.exception_handler(NotFoundError)
    @app.exception_handler(InvalidIdError)
    async def not_found(_: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    def detail(run_id: str) -> RunDetail:
        run = storage.load_run(run_id)
        results = storage.load_results(run_id)
        return RunDetail(run=run, results=results, summary=summarize(run, results))

    @app.get("/healthz", include_in_schema=False)
    def healthz() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/health")
    def health() -> Health:
        return Health(
            status="ok",
            mock_grader=settings.use_mock_grader,
            model="mock" if settings.use_mock_grader else settings.model,
            api_key_set=bool(settings.gemini_api_key),
        )

    @app.get("/api/rubrics")
    def list_rubrics() -> list[Rubric]:
        return storage.list_rubrics()

    @app.post("/api/rubrics", status_code=201)
    def save_rubric(rubric: Rubric) -> Rubric:
        rubric = rubric.model_copy(update={"id": new_id(), "created_at": utcnow()})
        storage.save_rubric(rubric)
        return rubric

    @app.get("/api/runs")
    def list_runs() -> list[RunSummary]:
        return [summarize(r, storage.load_results(r.id)) for r in storage.list_runs()]

    @app.post("/api/runs", status_code=201)
    async def create_run(
        rubric: Annotated[str, Form()], files: Annotated[list[UploadFile], File()]
    ) -> RunDetail:
        try:
            parsed = Rubric.model_validate_json(rubric)
        except ValidationError as e:
            raise HTTPException(422, detail=json.loads(e.json(include_url=False))) from e
        if len(files) > MAX_FILES:
            raise HTTPException(400, detail=f"Upload at most {MAX_FILES} files at a time.")

        snapshot = parsed.model_copy(update={"id": new_id(), "created_at": utcnow()})
        run_id = new_id()
        filenames = [f.filename or "submission" for f in files]
        names = [student_name_from_filename(n) for n in filenames]
        ids = assign_student_ids(names)
        submissions = []
        for upload, filename, name, student_id in zip(files, filenames, names, ids, strict=True):
            data = await upload.read()
            if len(data) > MAX_FILE_BYTES:
                extracted = Extracted("", 0, "File is larger than 10 MB.")
            else:
                extracted = await asyncio.to_thread(extract_text, filename, data)
                storage.save_original(run_id, student_id, filename, data)
            storage.save_submission_text(run_id, student_id, extracted.text)
            submissions.append(
                Submission(
                    student_id=student_id,
                    student_name=name,
                    filename=filename,
                    word_count=extracted.word_count,
                    warning=extracted.warning,
                )
            )

        run = Run(id=run_id, rubric=snapshot, submissions=submissions)
        storage.save_run(run)
        for submission in submissions:
            storage.save_result(run_id, new_result(run, submission))
        return detail(run_id)

    @app.get("/api/runs/{run_id}")
    def get_run(run_id: str) -> RunDetail:
        return detail(run_id)

    @app.patch("/api/runs/{run_id}/students/{student_id}")
    def rename_student(run_id: str, student_id: str, body: RenameIn) -> StudentResult:
        if manager.is_active(run_id):
            raise HTTPException(409, detail="Names can't be changed while grading is running.")
        run = storage.load_run(run_id)
        submission = find_submission(run, student_id)
        submission.student_name = body.student_name
        storage.save_run(run)
        result = storage.load_result(run_id, student_id) or new_result(run, submission)
        result.student_name = body.student_name
        storage.save_result(run_id, result)
        return result

    @app.post("/api/runs/{run_id}/start", status_code=202)
    async def start_run(run_id: str) -> RunSummary:
        try:
            manager.start(run_id)
        except GradingError as e:
            raise HTTPException(400, detail=str(e)) from e
        return detail(run_id).summary

    @app.post("/api/runs/{run_id}/students/{student_id}/retry", status_code=202)
    async def retry_student(run_id: str, student_id: str) -> StudentResult:
        try:
            manager.retry(run_id, student_id)
        except AlreadyGradingError as e:
            raise HTTPException(409, detail=str(e)) from e
        except GradingError as e:
            raise HTTPException(400, detail=str(e)) from e
        result = storage.load_result(run_id, student_id)
        assert result is not None
        return result

    @app.get("/api/runs/{run_id}/stream")
    async def stream_run(run_id: str) -> StreamingResponse:
        storage.load_run(run_id)
        queue = manager.subscribe(run_id)

        async def events() -> AsyncIterator[str]:
            try:
                snapshot = detail(run_id)
                yield sse("snapshot", snapshot.model_dump(mode="json"))
                if not manager.is_active(run_id):
                    yield sse("run_done", snapshot.summary.model_dump(mode="json"))
                    return
                while True:
                    try:
                        name, data = await asyncio.wait_for(queue.get(), KEEPALIVE_SECONDS)
                    except asyncio.TimeoutError:
                        yield ": keep-alive\n\n"
                        continue
                    yield sse(name, data)
                    if name == "run_done":
                        return
            finally:
                manager.unsubscribe(run_id, queue)

        return StreamingResponse(
            events(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    @app.get("/api/runs/{run_id}/export.csv")
    def export_csv(run_id: str) -> Response:
        run = storage.load_run(run_id)
        slug = assign_student_ids([run.rubric.title])[0]
        return Response(
            results_csv(run, storage.load_results(run_id)),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="evalora-{slug}.csv"'},
        )

    @app.get("/api/runs/{run_id}/students/{student_id}/report.md")
    def report(run_id: str, student_id: str) -> Response:
        run = storage.load_run(run_id)
        submission = find_submission(run, student_id)
        result = storage.load_result(run_id, student_id) or new_result(run, submission)
        return Response(
            student_report(run, result),
            media_type="text/markdown",
            headers={"Content-Disposition": f'attachment; filename="{student_id}-report.md"'},
        )

    if (frontend_dir / "index.html").exists():
        app.mount("/assets", StaticFiles(directory=frontend_dir / "assets"), name="assets")

        @app.get("/", include_in_schema=False)
        def index() -> FileResponse:
            return FileResponse(frontend_dir / "index.html", headers={"Cache-Control": "no-cache"})

    else:

        @app.get("/", include_in_schema=False)
        def index_missing() -> PlainTextResponse:
            return PlainTextResponse(
                "The frontend is not built. Run `npm install` and `npm run build` in the frontend "
                "folder, then restart the server. The API is available under /api.",
                status_code=503,
            )

    return app


app = create_app()
