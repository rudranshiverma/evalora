# Evalora

Evalora grades student assignments against a teacher's rubric using Google's Gemini model. Every score comes with a quote from the student's own work, and the app checks that the quote really exists before showing it as verified.

## Live demo

**Website:** https://evalora-d73m.onrender.com/


Your browser asks for these when the site opens.

- The site runs on Render's free plan. After 15 minutes without visitors it goes to sleep, and the next visit takes about a minute to load. It is starting up, not broken.
- Batches graded earlier may be gone, because the free plan's storage is cleared whenever the site sleeps or restarts.
- Grading uses Gemini's free tier, where Google may use submitted content to improve its products. Use the sample essays or made-up text, not real student work.

## Try it in two minutes

1. Open the website and sign in.
2. On **Build the rubric**, click **Use sample**, then **Continue to upload**.
3. Download the five essays in [`samples/essays`](samples/essays): three TXT, one DOCX and one PDF. Drop them into the upload box and click **Upload 5 files**.
4. Check the student names, then click **Start grading 5 students**.
5. Watch the scores arrive. Open a student to see each criterion's quote, reasoning, strength and improvement, or export the whole class as CSV.

`kabir_singh.txt` ends with a note telling the grader to ignore the rubric and award full marks. It is there to test whether the grader follows the rubric instead.

## Features

- Build a rubric with weighted criteria, or reuse a saved one
- Upload a batch of PDF, DOCX or TXT submissions, one per student
- Watch scores stream in live as each student is graded
- Per-criterion scores, evidence quotes, strengths and improvements, plus overall feedback
- Flags for anything a teacher should check: quotes that can't be found, missing evidence, very long submissions
- Retry failed students or regrade any student
- Export the class as CSV, or download a report per student
- Grading continues on the server if you close the tab, and resumes after a restart

## How grading works

1. Text is extracted from each file. Unreadable files are listed with a reason and marked failed instead of stopping the batch.
2. Each submission is sent to Gemini once, with the rubric and the submission clearly separated. The model is told to treat the submission as work to grade and to ignore any instructions inside it.
3. For each criterion, the model quotes evidence first, then writes its reasoning, then gives a score.
4. Python, not the model, clamps each score to the criterion's range, rounds to half points and adds up the total.
5. Each quote is searched for in the submission, ignoring spacing, case and curly quotes. Quotes that can't be found are flagged for the teacher.
6. Rate limits, timeouts and malformed responses are retried with increasing waits. Problems that retrying can't fix, like an invalid key, fail straight away with Gemini's own message.

At most two students are graded at a time, which keeps a batch inside the free tier's per-minute limits.

## Built with

- **Backend:** Python, FastAPI, Pydantic, Google Gen AI SDK (Gemini Flash), PyMuPDF and python-docx
- **Frontend:** React 19, TypeScript, Vite
- **Storage:** JSON files on disk, written atomically
- **Hosting:** Docker container on Render's free plan

## Run it locally

You need Python 3.10 or newer. Node.js is not needed, because the built frontend is included.

```bash
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

Copy `.env.example` to `.env` and paste in a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey). Leave `EVALORA_PASSWORD` empty to skip the sign-in locally.

```bash
uvicorn app.main:app --app-dir backend
```

Open http://localhost:8000.

To try it without an API key, set `EVALORA_MOCK_GRADER=true` in `.env`. The mock grader returns made-up scores that still quote real sentences from each submission.

## Configuration

Set these in `.env` locally, or in Render's dashboard for the live site.

| Variable | Default | Meaning |
| --- | --- | --- |
| `GEMINI_API_KEY` | | Your Gemini API key |
| `EVALORA_MODEL` | `gemini-flash-latest` | Gemini model used for grading |
| `EVALORA_MOCK_GRADER` | `false` | Use the offline mock grader |
| `EVALORA_MAX_CONCURRENCY` | `2` | Students graded at the same time |
| `EVALORA_DATA_DIR` | `data/` | Where rubrics, submissions and results are saved |
| `EVALORA_USERNAME` | `teacher` | Sign-in name when a password is set |
| `EVALORA_PASSWORD` | | Sign-in password; leave empty to run without sign-in |

## Where data is stored

Everything is saved as plain files under `data/`:

```
data/
  rubrics/<rubric>.json
  runs/<run>/run.json              rubric copy, model, timestamps
  runs/<run>/originals/<student>   uploaded file
  runs/<run>/submissions/<student>.txt
  runs/<run>/results/<student>.json
```

`data/` is in `.gitignore`, so student work never ends up on GitHub. On the live site this folder sits on Render's temporary disk.

## Deployment

The live demo runs as one Docker web service on Render, defined in `render.yaml`. `GEMINI_API_KEY` and `EVALORA_PASSWORD` are marked `sync: false`, so their values are entered in Render's dashboard and never stored in this repository.

To deploy your own copy:

1. Push this repository to your GitHub account.
2. In Render, choose **New**, then **Blueprint**, and connect the repository.
3. Enter a Gemini API key and a sign-in password when prompted, then click **Deploy Blueprint**.

`/healthz` answers without sign-in so Render can check the service is up. Run a single instance only, because grading runs in the server's memory.

## Project structure

```
backend/app/
  main.py      API routes and live streaming
  runner.py    background grading, retries, recovery after restart
  grader.py    prompt, Gemini call, quote checks, scoring, mock grader
  ingest.py    PDF/DOCX/TXT extraction and student names
  storage.py   all reads and writes to data/
  models.py    data shapes
  reports.py   CSV export and student reports
  auth.py      password sign-in for deployed copies
backend/tests/ pytest suite
Dockerfile     container image used for deployment
render.yaml    Render deployment settings (no secrets)
frontend/src/  React + TypeScript app (built output in frontend/dist)
samples/       sample rubric and essays
```

## Development

```bash
pip install -r requirements-dev.txt
pytest
ruff check backend && ruff format --check backend
```

To change the frontend, install Node.js 20 or newer, then:

```bash
cd frontend
npm install
npm run dev      # dev server with hot reload, proxies /api to port 8000
npm run build    # updates frontend/dist, which the backend serves
```

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /healthz` | Health check for the host, open without sign-in |
| `GET /api/health` | Mode, model and whether a key is set |
| `GET, POST /api/rubrics` | List or save rubrics |
| `POST /api/runs` | Upload a rubric and files (multipart) |
| `PATCH /api/runs/{id}/students/{sid}` | Rename a student before grading |
| `POST /api/runs/{id}/start` | Start or resume grading |
| `GET /api/runs/{id}/stream` | Live updates as server-sent events |
| `GET /api/runs`, `GET /api/runs/{id}` | Past batches and full results |
| `POST /api/runs/{id}/students/{sid}/retry` | Regrade one student |
| `GET /api/runs/{id}/export.csv` | Class results as CSV |
| `GET /api/runs/{id}/students/{sid}/report.md` | One student's report |

Interactive API docs are at `/docs` while the server runs.

## Limitations

- Scanned PDFs have no text layer and are not read. OCR is not included.
- Grades are AI-assisted and should be reviewed by a teacher before being shared.
- Submissions longer than 100,000 characters are cut and flagged.
- The live demo forgets batches when it sleeps or restarts.

## Roadmap

- Measure agreement with human graders on public datasets such as ASAP 2.0
- Grade each submission several times and flag disagreement
- Calibrate scores against a small set of teacher-graded samples
- Fine-tune a small open model for private, offline grading