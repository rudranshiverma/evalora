import { formatDate, plural } from "../format";
import type { RunSummary } from "../types";
import { StatusBadge } from "./StatusBadge";

export function RunHeader({ summary }: { summary: RunSummary }) {
  const details = [
    plural(summary.total, "student"),
    `created ${formatDate(summary.created_at)}`,
    summary.model ? `graded with ${summary.model}` : null,
  ].filter(Boolean);

  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{summary.title}</h1>
        <p className="page-subtitle">{details.join(", ")}</p>
      </div>
      <StatusBadge status={summary.status} />
    </div>
  );
}
