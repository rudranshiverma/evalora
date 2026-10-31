import { useState } from "react";
import { api } from "../api";
import { formatDate, initials, plural } from "../format";
import type { RunDetail, StudentResult, Submission } from "../types";
import { AlertIcon, UsersIcon } from "./Icons";
import { PageHead } from "./PageHead";
import { Panel } from "./Panel";

function NameField({
  runId,
  submission,
  disabled,
}: {
  runId: string;
  submission: Submission;
  disabled: boolean;
}) {
  const [value, setValue] = useState(submission.student_name);
  const [saved, setSaved] = useState(submission.student_name);
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");

  const commit = async () => {
    const name = value.trim();
    if (!name) {
      setValue(saved);
      return;
    }
    if (name === saved) return;
    setState("saving");
    try {
      const result = await api.renameStudent(runId, submission.student_id, name);
      setSaved(result.student_name);
      setValue(result.student_name);
      setState("idle");
    } catch {
      setState("error");
    }
  };

  return (
    <div className="who">
      <span className="avatar">{initials(value || saved)}</span>
      <div className="name-field">
        <input
          className={`input input--inline ${state === "error" ? "input--invalid" : ""}`}
          value={value}
          maxLength={120}
          disabled={disabled}
          aria-label={`Student name for ${submission.filename}`}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") setValue(saved);
          }}
        />
        {state === "saving" && <span className="hint">Saving...</span>}
        {state === "error" && <span className="field-error">Not saved, try again</span>}
      </div>
    </div>
  );
}

function Note({ submission, result }: { submission: Submission; result?: StudentResult }) {
  if (result?.status === "done") return <span className="badge badge--success">Already graded</span>;
  if (submission.word_count === 0) {
    return (
      <span className="note note--danger">
        <AlertIcon />
        {submission.warning ?? "No readable text."}
      </span>
    );
  }
  if (submission.warning) {
    return (
      <span className="note note--warning">
        <AlertIcon />
        {submission.warning}
      </span>
    );
  }
  return <span className="badge badge--info">Ready</span>;
}

export function ReviewPanel({ detail, onStarted }: { detail: RunDetail; onStarted: () => void }) {
  const { run, summary } = detail;
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const results = new Map(detail.results.map((r) => [r.student_id, r]));
  const unreadable = run.submissions.filter((s) => s.word_count === 0).length;
  const resuming = summary.done > 0;

  const start = async () => {
    setStarting(true);
    setError(null);
    try {
      await api.startRun(run.id);
      onStarted();
    } catch (e) {
      setError((e as Error).message);
      setStarting(false);
    }
  };

  const label = starting
    ? "Starting..."
    : resuming
      ? "Resume grading"
      : `Start grading ${plural(run.submissions.length, "student")}`;

  return (
    <>
      <PageHead
        title="Review submissions"
        subtitle={`${run.rubric.title}, ${plural(run.submissions.length, "file")}, uploaded ${formatDate(run.created_at)}`}
        step={1}
        actions={
          <>
            <a className="btn" href="#/upload">
              Upload different files
            </a>
            <button className="btn btn--primary" onClick={start} disabled={starting}>
              {label}
            </button>
          </>
        }
      />
      <div className="container stack">
        {resuming && (
          <div className="alert alert--info">
            This batch was interrupted. The {plural(summary.done, "student")} already graded will be
            kept, and grading continues with the rest.
          </div>
        )}
        {unreadable > 0 && (
          <div className="alert alert--warning">
            {plural(unreadable, "file")} could not be read and will be marked as failed. The rest
            will still be graded.
          </div>
        )}
        {error && <div className="alert alert--error">{error}</div>}

        <Panel
          icon={<UsersIcon />}
          title="Students"
          description="Check each name before grading. Names appear on reports and in the CSV export."
          meta={
            <span className="badge badge--info badge--lg">
              {plural(run.submissions.length, "student")}
            </span>
          }
        >
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Student name</th>
                  <th>File</th>
                  <th className="num">Words</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {run.submissions.map((s) => (
                  <tr key={s.student_id}>
                    <td>
                      <NameField runId={run.id} submission={s} disabled={starting} />
                    </td>
                    <td className="muted file-cell">{s.filename}</td>
                    <td className="num">{s.word_count || "-"}</td>
                    <td>
                      <Note submission={s} result={results.get(s.student_id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  );
}