import { useEffect, useState } from "react";
import { api } from "../api";
import { ChevronRightIcon, FolderIcon, PlusIcon } from "../components/Icons";
import { PageHead } from "../components/PageHead";
import { Panel } from "../components/Panel";
import { StatusBadge } from "../components/StatusBadge";
import { formatDate, formatScore, plural } from "../format";
import { navigate } from "../router";
import type { RunSummary } from "../types";

export function RunsPage() {
  const [runs, setRuns] = useState<RunSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .listRuns()
      .then((data) => active && setRuns(data))
      .catch((e: Error) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <PageHead
        title="Past batches"
        subtitle="Every batch you have graded, newest first."
        actions={
          <a className="btn btn--primary" href="#/rubric">
            <PlusIcon />
            New batch
          </a>
        }
      />
      <div className="container stack">
        {error && <div className="alert alert--error">{error}</div>}
        {runs === null && !error && <p className="muted">Loading...</p>}

        {runs?.length === 0 && (
          <Panel icon={<FolderIcon />} title="Batches">
            <div className="empty">
              <p className="empty__title">No batches yet</p>
              <p className="muted">Create a rubric and upload submissions to grade your first batch.</p>
              <a className="btn btn--primary" href="#/rubric">
                Start a batch
              </a>
            </div>
          </Panel>
        )}

        {runs && runs.length > 0 && (
          <Panel
            icon={<FolderIcon />}
            title="Batches"
            description="Open a batch to see its results."
            meta={
              <span className="badge badge--info badge--lg">
                {plural(runs.length, "batch", "batches")}
              </span>
            }
          >
            <div className="table-wrap">
              <table className="table table--clickable">
                <thead>
                  <tr>
                    <th>Batch</th>
                    <th className="num">Students</th>
                    <th className="num">Graded</th>
                    <th className="num">Average</th>
                    <th>Status</th>
                    <th aria-label="Open" />
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id} onClick={() => navigate(`/runs/${run.id}`)}>
                      <td>
                        <a href={`#/runs/${run.id}`} className="table__primary">
                          {run.title}
                        </a>
                        <span className="table__sub">{formatDate(run.created_at)}</span>
                      </td>
                      <td className="num">{run.total}</td>
                      <td className="num">
                        {run.done}
                        {run.failed > 0 && <span className="text-danger"> ({run.failed} failed)</span>}
                      </td>
                      <td className="num total">
                        {run.average_total === null ? (
                          <span className="muted">-</span>
                        ) : (
                          <>
                            <strong>{formatScore(run.average_total)}</strong>{" "}
                            <small>/ {formatScore(run.max_total)}</small>
                            <span className="minibar">
                              <i style={{ width: `${(run.average_total / run.max_total) * 100}%` }} />
                            </span>
                          </>
                        )}
                      </td>
                      <td>
                        <StatusBadge status={run.status} />
                      </td>
                      <td className="num">
                        <span className="chevron">
                          <ChevronRightIcon />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
      </div>
    </>
  );
}