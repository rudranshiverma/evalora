import csv
import io

from app.models import Run, StudentResult, StudentStatus


def fmt(value: float | None) -> str:
    return "" if value is None else f"{value:g}"


def safe_cell(value: str) -> str:
    return f"'{value}" if value[:1] in ("=", "+", "-", "@") else value


def results_csv(run: Run, results: list[StudentResult]) -> bytes:
    criteria = run.rubric.criteria
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        [
            "Student",
            "Status",
            *[f"{c.name} (/{fmt(c.max_points)})" for c in criteria],
            "Total",
            "Max total",
            "Flags",
            "Error",
        ]
    )
    for r in results:
        scores = {c.criterion: c.score for c in r.criteria}
        writer.writerow(
            [
                safe_cell(r.student_name),
                r.status.value,
                *[fmt(scores.get(c.name)) for c in criteria],
                fmt(r.total),
                fmt(r.max_total),
                safe_cell("; ".join(r.flags)),
                safe_cell(r.error or ""),
            ]
        )
    return buf.getvalue().encode("utf-8-sig")


def student_report(run: Run, result: StudentResult) -> str:
    lines = [f"# {result.student_name}", "", run.rubric.title, ""]
    if result.status != StudentStatus.done:
        lines.append(f"Not graded: {result.error or result.status.value}")
        return "\n".join(lines) + "\n"

    graded_on = result.graded_at.strftime("%d %b %Y") if result.graded_at else "unknown date"
    notice = f"AI-assisted grading ({result.model}, {graded_on}). Review before sharing."
    lines += [f"**Total: {fmt(result.total)} / {fmt(result.max_total)}**", "", f"_{notice}_", ""]
    for c in result.criteria:
        lines += [f"## {c.criterion}: {fmt(c.score)} / {fmt(c.max_points)}", ""]
        if c.evidence_quote:
            note = "" if c.evidence_verified else " (not found in submission)"
            lines += [f"> {c.evidence_quote}{note}", ""]
        lines += [c.justification, ""]
        if c.strengths:
            lines += [f"**Strength:** {c.strengths}", ""]
        if c.improvements:
            lines += [f"**To improve:** {c.improvements}", ""]
    if result.overall_feedback:
        lines += ["## Overall feedback", "", result.overall_feedback, ""]
    if result.flags:
        lines += ["## Flags for the teacher", "", *[f"- {f}" for f in result.flags], ""]
    return "\n".join(lines).rstrip() + "\n"
