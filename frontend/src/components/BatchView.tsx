import { Fragment, type ReactNode, useState } from "react";
import { api } from "../api";
import { formatDate, formatScore, initials, plural } from "../format";
import { batchStats, scoreFor, scoreLevel, scoreSpread } from "../results";
import type { RunDetail, StudentResult } from "../types";
import {
  AlertIcon,
  CheckCircleIcon,
  ChevronIcon,
  ClockIcon,
  DownloadIcon,
  TargetIcon,
  UsersIcon,
  XCircleIcon,
} from "./Icons";
import { PageHead } from "./PageHead";
import { Panel } from "./Panel";
import { StatusBadge } from "./StatusBadge";
import { StudentDetail } from "./StudentDetail";

type Filter = "all" | "review" | "failed";

const FILTER_LABELS: Record<Filter, string> = {
  all: "All",
  review: "Needs review",
  failed: "Failed",
};

function matches(result: StudentResult, filter: Filter): boolean {
  if (filter === "failed") return result.status === "failed";
  if (filter === "review") return result.status === "done" && result.flags.length > 0;
  return true;
}

interface StatProps {
  label: string;
  icon: ReactNode;
  value: ReactNode;
  hint: string;
  tone?: "warn" | "danger" | "quiet";
}

function Stat({ label, icon, value, hint, tone }: StatProps) {
  return (
    <div className={`stat ${tone ? `stat--${tone}` : ""}`}>
      <div className="stat__top">
        {label}
        <span className="stat__icon">{icon}</span>
      </div>
      <p className="stat__value">{value}</p>
      <p className="hint">{hint}</p>
    </div>
  );
}

function Stats({ results, maxTotal }: { results: StudentResult[]; maxTotal: number }) {
  const stats = batchStats(results);
  const spread = scoreSpread(results, maxTotal);
  const tallest = Math.max(...spread.map((b) => b.count), 1);
  const unscored = stats.total - stats.done;

  return (
    <div className="stats">
      <div className="stat stat--feature">
        <div className="stat__top">
          Class average
          <span className="stat__icon">
            <TargetIcon />
          </span>
        </div>
        <p className="stat__value">
          {formatScore(stats.average === null ? null : Math.round(stats.average * 10) / 10)}{" "}
          <small>/ {formatScore(maxTotal)}</small>
        </p>
        <div className="spread" role="img" aria-label="How total scores are spread">
          {spread.map((b) => (
            <i
              key={b.label}
              className={b.count === 0 ? "is-empty" : ""}
              style={{ height: `${b.count === 0 ? 8 : (b.count / tallest) * 100}%` }}
              title={`${plural(b.count, "student")} scored ${b.label}`}
            />
          ))}
        </div>
        <div className="spread__labels">
          {spread.map((b) => (
            <span key={b.label}>{b.label}</span>
          ))}
        </div>
      </div>
      <Stat
        label="Graded"
        icon={<CheckCircleIcon />}
        value={
          <>
            {stats.done} <small>/ {stats.total}</small>
          </>
        }
        hint={unscored ? `${plural(unscored, "submission")} not scored` : "All submissions scored"}
      />
      <Stat
        label="Needs review"
        icon={<AlertIcon />}
        value={stats.flagged}
        hint={
          stats.flagged === 0
            ? "No scores flagged"
            : stats.flagged === 1
              ? "Student with a flagged score"
              : "Students with flagged scores"
        }
        tone={stats.flagged ? "warn" : "quiet"}
      />
      <Stat
        label="Failed"
        icon={<XCircleIcon />}
        value={stats.failed}
        hint={stats.failed ? "Open a failed student to retry" : "No grading errors"}
        tone={stats.failed ? "danger" : "quiet"}
      />
    </div>
  );
}

function Progress({ results }: { results: StudentResult[] }) {
  const stats = batchStats(results);
  const percent = stats.total ? (stats.finished / stats.total) * 100 : 0;

  return (
    <Panel
      icon={<ClockIcon />}
      title="Grading in progress"
      description="Grading runs on the server, so you can leave this page and come back."
    >
      <div className="panel__body">
        <div className="progress__top">
          <span className="progress__label">
            Graded {stats.finished} of {stats.total}
          </span>
          <span className="muted">
            {stats.grading} in progress, {stats.queued} queued
          </span>
        </div>
        <div
          className="progress__bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={stats.total}
          aria-valuenow={stats.finished}
        >
          <div className="progress__fill" style={{ width: `${percent}%` }} />
        </div>
      </div>
    </Panel>
  );
}

interface Props {
  detail: RunDetail;
  connected: boolean;
  onRetry: (studentId: string) => Promise<void>;
}

export function BatchView({ detail, connected, onRetry }: Props) {
  const { run, results } = detail;
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState<string | null>(null);

  const running = run.status === "running";
  const stats = batchStats(results);
  const criteria = run.rubric.criteria;
  const showCriteria = criteria.length <= 6;
  const columns = 5 + (showCriteria ? criteria.length : 0);
  const visible = results.filter((r) => matches(r, filter));
  const counts: Record<Filter, number> = {
    all: stats.total,
    review: stats.flagged,
    failed: stats.failed,
  };

  const subtitle = [
    plural(run.submissions.length, "student"),
    run.model && `${running ? "grading" : "graded"} with ${run.model}`,
    !running && run.finished_at && `finished ${formatDate(run.finished_at)}`,
  ]
    .filter(Boolean)
    .join(", ");

  const retry = async (studentId: string) => {
    setError(null);
    try {
      await onRetry(studentId);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <>
      <PageHead
        title={run.rubric.title}
        subtitle={subtitle}
        step={running ? 2 : 3}
        actions={
          <>
            <StatusBadge status={run.status} large />
            <a className="btn" href={api.exportCsvUrl(run.id)} download>
              <DownloadIcon />
              Export CSV
            </a>
          </>
        }
      />
      <div className="container stack">
        {!connected && running && (
          <div className="alert alert--warning">Connection lost. Reconnecting...</div>
        )}
        {error && <div className="alert alert--error">{error}</div>}
        {running ? (
          <Progress results={results} />
        ) : (
          <Stats results={results} maxTotal={run.rubric.max_total} />
        )}

        <Panel
          icon={<UsersIcon />}
          title="Students"
          description={
            running
              ? "Results appear here as each student is graded."
              : "Open a student to see the evidence behind each score."
          }
          meta={
            <div className="segmented" role="group" aria-label="Filter students">
              {(Object.keys(FILTER_LABELS) as Filter[]).map((f) => (
                <button
                  key={f}
                  className={`segmented__btn ${filter === f ? "is-active" : ""}`}
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                >
                  {FILTER_LABELS[f]}
                  <span className="segmented__count">{counts[f]}</span>
                </button>
              ))}
            </div>
          }
        >
          <div className="table-wrap">
            <table className="table table--clickable">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Status</th>
                  {showCriteria &&
                    criteria.map((c) => (
                      <th key={c.name} className="mid crit-col" title={c.name}>
                        {c.name}
                        <small>/ {formatScore(c.max_points)}</small>
                      </th>
                    ))}
                  <th className="num">Total</th>
                  <th>Flags</th>
                  <th aria-label="Details" />
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const open = expanded === r.student_id;
                  return (
                    <Fragment key={r.student_id}>
                      <tr
                        className={open ? "is-open" : ""}
                        aria-expanded={open}
                        onClick={() => setExpanded(open ? null : r.student_id)}
                      >
                        <td>
                          <div className="who">
                            <span className="avatar">{initials(r.student_name)}</span>
                            <strong>{r.student_name}</strong>
                          </div>
                        </td>
                        <td>
                          <StatusBadge status={r.status} />
                        </td>
                        {showCriteria &&
                          criteria.map((c) => {
                            const score = scoreFor(r, c.name);
                            return (
                              <td key={c.name} className="mid">
                                {score === null ? (
                                  <span className="muted">-</span>
                                ) : (
                                  <span className={`cell cell--${scoreLevel(score, c.max_points)}`}>
                                    {formatScore(score)}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        <td className="num total">
                          {r.total === null ? (
                            <span className="muted">-</span>
                          ) : (
                            <>
                              <strong>{formatScore(r.total)}</strong>{" "}
                              <small>/ {formatScore(r.max_total)}</small>
                              <span className="minibar">
                                <i style={{ width: `${(r.total / r.max_total) * 100}%` }} />
                              </span>
                            </>
                          )}
                        </td>
                        <td>
                          {r.flags.length > 0 && (
                            <span className="badge badge--warning">
                              <AlertIcon />
                              {plural(r.flags.length, "flag")}
                            </span>
                          )}
                        </td>
                        <td className="num">
                          <ChevronIcon open={open} />
                        </td>
                      </tr>
                      {open && (
                        <tr className="detail-row">
                          <td colSpan={columns}>
                            <StudentDetail runId={run.id} result={r} onRetry={retry} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {visible.length === 0 && (
                  <tr className="detail-row">
                    <td colSpan={columns} className="empty-row">
                      No students match this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  );
}