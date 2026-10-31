import { formatScore } from "./format";
import type { StudentResult } from "./types";

export interface BatchStats {
  total: number;
  done: number;
  failed: number;
  grading: number;
  queued: number;
  finished: number;
  flagged: number;
  average: number | null;
}

export function batchStats(results: StudentResult[]): BatchStats {
  const count = (status: StudentResult["status"]) =>
    results.filter((r) => r.status === status).length;
  const totals = results
    .filter((r) => r.status === "done" && r.total !== null)
    .map((r) => r.total as number);
  const done = count("done");
  const failed = count("failed");
  return {
    total: results.length,
    done,
    failed,
    grading: count("grading"),
    queued: count("queued"),
    finished: done + failed,
    flagged: results.filter((r) => r.status === "done" && r.flags.length > 0).length,
    average: totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : null,
  };
}

export interface SpreadBucket {
  label: string;
  count: number;
}

export function scoreSpread(results: StudentResult[], maxTotal: number, buckets = 5) {
  const width = maxTotal / buckets;
  const counts = new Array<number>(buckets).fill(0);
  for (const r of results) {
    if (r.status !== "done" || r.total === null || width <= 0) continue;
    counts[Math.min(Math.floor(r.total / width), buckets - 1)] += 1;
  }
  return counts.map<SpreadBucket>((count, i) => ({
    label: `${formatScore(i * width)}-${formatScore((i + 1) * width)}`,
    count,
  }));
}

export function scoreLevel(score: number, maxPoints: number): number {
  const ratio = maxPoints > 0 ? score / maxPoints : 0;
  if (ratio >= 0.85) return 3;
  if (ratio >= 0.7) return 2;
  if (ratio >= 0.5) return 1;
  return 0;
}

export function upsert(results: StudentResult[], result: StudentResult): StudentResult[] {
  const index = results.findIndex((r) => r.student_id === result.student_id);
  if (index === -1) return [...results, result];
  return results.map((r, i) => (i === index ? result : r));
}

export function scoreFor(result: StudentResult, criterion: string): number | null {
  return result.criteria.find((c) => c.criterion === criterion)?.score ?? null;
}