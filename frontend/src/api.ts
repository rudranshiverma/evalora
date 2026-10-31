import type {
  Health,
  Rubric,
  RubricDraft,
  RunDetail,
  RunSummary,
  StudentResult,
} from "./types";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail)) {
      const messages = body.detail.map((d: { msg?: string }) => d.msg).filter(Boolean);
      if (messages.length) return messages.join("; ");
    }
  } catch {
    // Non-JSON error body, fall back to the status code.
  }
  return `Request failed (${response.status})`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new ApiError(0, "Can't reach the Evalora server. Is it running?");
  }
  if (!response.ok) throw new ApiError(response.status, await errorMessage(response));
  return (await response.json()) as T;
}

function json(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

const runPath = (runId: string) => `/api/runs/${encodeURIComponent(runId)}`;
const studentPath = (runId: string, studentId: string) =>
  `${runPath(runId)}/students/${encodeURIComponent(studentId)}`;

export const api = {
  health: () => request<Health>("/api/health"),
  listRubrics: () => request<Rubric[]>("/api/rubrics"),
  saveRubric: (draft: RubricDraft) => request<Rubric>("/api/rubrics", json("POST", draft)),
  listRuns: () => request<RunSummary[]>("/api/runs"),
  getRun: (runId: string) => request<RunDetail>(runPath(runId)),
  createRun: (draft: RubricDraft, files: File[]) => {
    const form = new FormData();
    form.append("rubric", JSON.stringify(draft));
    for (const file of files) form.append("files", file);
    return request<RunDetail>("/api/runs", { method: "POST", body: form });
  },
  renameStudent: (runId: string, studentId: string, name: string) =>
    request<StudentResult>(studentPath(runId, studentId), json("PATCH", { student_name: name })),
  startRun: (runId: string) => request<RunSummary>(`${runPath(runId)}/start`, { method: "POST" }),
  retryStudent: (runId: string, studentId: string) =>
    request<StudentResult>(`${studentPath(runId, studentId)}/retry`, { method: "POST" }),
  exportCsvUrl: (runId: string) => `${runPath(runId)}/export.csv`,
  reportUrl: (runId: string, studentId: string) => `${studentPath(runId, studentId)}/report.md`,
};

export interface StreamHandlers {
  onSnapshot: (detail: RunDetail) => void;
  onStudent: (result: StudentResult) => void;
  onDone: (summary: RunSummary) => void;
  onConnectionChange?: (connected: boolean) => void;
}

function parse<T>(event: Event): T {
  return JSON.parse((event as MessageEvent<string>).data) as T;
}

export function streamRun(runId: string, handlers: StreamHandlers): () => void {
  const source = new EventSource(`${runPath(runId)}/stream`);
  source.addEventListener("snapshot", (e) => handlers.onSnapshot(parse<RunDetail>(e)));
  source.addEventListener("student", (e) => handlers.onStudent(parse<StudentResult>(e)));
  source.addEventListener("run_done", (e) => {
    source.close();
    handlers.onDone(parse<RunSummary>(e));
  });
  source.onopen = () => handlers.onConnectionChange?.(true);
  source.onerror = () => handlers.onConnectionChange?.(false);
  return () => source.close();
}
