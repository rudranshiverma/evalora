import { formatScore, plural } from "../format";
import { maxTotal } from "../rubric";
import type { RubricDraft } from "../types";

const SHADES = ["#0e2240", "#1d4b94", "#2f6fd6", "#7fa9e3", "#b9d3f0"];

const shade = (index: number) => SHADES[index % SHADES.length];

export function RubricSummary({ draft }: { draft: RubricDraft }) {
  const total = maxTotal(draft);

  return (
    <>
      <div className="summary__total">
        <strong>{formatScore(total)}</strong>
        <span>points across {plural(draft.criteria.length, "criterion", "criteria")}</span>
      </div>
      {total > 0 && (
        <div className="weights" aria-hidden="true">
          {draft.criteria.map(
            (c, i) =>
              c.max_points > 0 && (
                <i key={i} style={{ flexGrow: c.max_points, background: shade(i) }} />
              ),
          )}
        </div>
      )}
      <ul className="legend">
        {draft.criteria.map((c, i) => (
          <li key={i}>
            <b style={{ background: shade(i) }} />
            <span>{c.name.trim() || "Untitled criterion"}</span>
            <span className="legend__pts">{formatScore(c.max_points)} pts</span>
            <em>{total > 0 ? Math.round((Math.max(c.max_points, 0) / total) * 100) : 0}%</em>
          </li>
        ))}
      </ul>
    </>
  );
}