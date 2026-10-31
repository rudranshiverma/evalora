import { api } from "../api";
import { formatDate, formatScore } from "../format";
import type { CriterionResult, StudentResult } from "../types";
import { AlertIcon, CheckCircleIcon, DownloadIcon, InfoIcon, RefreshIcon } from "./Icons";

function CriterionCard({ item }: { item: CriterionResult }) {
  const percent = item.max_points ? (item.score / item.max_points) * 100 : 0;

  return (
    <article className="crit">
      <header className="crit__head">
        <h3 className="crit__name">{item.criterion}</h3>
        <span className="crit__score">
          {formatScore(item.score)} / {formatScore(item.max_points)}
        </span>
      </header>
      <div className="crit__body">
        <div className="scorebar">
          <i style={{ width: `${percent}%` }} />
        </div>
        {item.evidence_quote ? (
          <figure className="evidence">
            <blockquote className={`quote ${item.evidence_verified ? "" : "quote--unverified"}`}>
              <mark>{item.evidence_quote}</mark>
            </blockquote>
            <figcaption className={`verified ${item.evidence_verified ? "" : "verified--warn"}`}>
              {item.evidence_verified ? <CheckCircleIcon /> : <AlertIcon />}
              {item.evidence_verified
                ? "Found in submission"
                : "Quote not found in submission. Check this score."}
            </figcaption>
          </figure>
        ) : (
          <p className="verified verified--warn">
            <AlertIcon />
            No evidence quoted. Check this score.
          </p>
        )}
        <p className="why">{item.justification}</p>
        {(item.strengths || item.improvements) && (
          <div className="notes">
            {item.strengths && (
              <div className="notes__item">
                <b>Strength</b>
                {item.strengths}
              </div>
            )}
            {item.improvements && (
              <div className="notes__item notes__item--improve">
                <b>To improve</b>
                {item.improvements}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

interface Props {
  runId: string;
  result: StudentResult;
  onRetry: (studentId: string) => void;
}

export function StudentDetail({ runId, result, onRetry }: Props) {
  if (result.status === "queued" || result.status === "grading") {
    return (
      <p className="detail detail--waiting">
        {result.status === "grading" ? "Grading now..." : "Waiting to be graded."}
      </p>
    );
  }

  if (result.status === "failed") {
    return (
      <div className="detail detail--failed">
        <div className="alert alert--error">{result.error ?? "Grading failed."}</div>
        <button className="btn btn--sm" onClick={() => onRetry(result.student_id)}>
          <RefreshIcon />
          Retry
        </button>
      </div>
    );
  }

  const regrade = () => {
    if (window.confirm(`Regrade ${result.student_name}? The current grade will be replaced.`)) {
      onRetry(result.student_id);
    }
  };

  return (
    <div className="detail">
      <div className="detail__head">
        <p
          className="grade"
          aria-label={`Total ${formatScore(result.total)} out of ${formatScore(result.max_total)}`}
        >
          <strong>{formatScore(result.total)}</strong>
          <span>/ {formatScore(result.max_total)}</span>
        </p>
        <p className="notice">
          <InfoIcon />
          <span>
            AI-assisted grading by {result.model} on {formatDate(result.graded_at)}. Review the
            scores and evidence before sharing with students.
          </span>
        </p>
        <div className="detail__actions">
          <a className="btn btn--sm" href={api.reportUrl(runId, result.student_id)} download>
            <DownloadIcon />
            Download report
          </a>
          <button className="btn btn--sm btn--ghost" onClick={regrade}>
            <RefreshIcon />
            Regrade
          </button>
        </div>
      </div>

      {result.flags.length > 0 && (
        <div className="alert alert--warning">
          <strong>Check before sharing</strong>
          <ul className="flags">
            {result.flags.map((flag) => (
              <li key={flag}>{flag}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="crit-grid">
        {result.criteria.map((c) => (
          <CriterionCard key={c.criterion} item={c} />
        ))}
      </div>

      {result.overall_feedback && (
        <div className="overall">
          <h3>Overall feedback</h3>
          <p>{result.overall_feedback}</p>
        </div>
      )}
    </div>
  );
}