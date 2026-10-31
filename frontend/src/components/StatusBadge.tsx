import type { RunStatus, StudentStatus } from "../types";

const LABELS: Record<RunStatus | StudentStatus, string> = {
  queued: "Queued",
  grading: "Grading",
  done: "Done",
  failed: "Failed",
  ready: "Not started",
  running: "Grading",
  completed: "Completed",
};

const TONES: Record<RunStatus | StudentStatus, string> = {
  queued: "neutral",
  grading: "live",
  done: "success",
  failed: "danger",
  ready: "neutral",
  running: "live",
  completed: "success",
};

interface Props {
  status: RunStatus | StudentStatus;
  large?: boolean;
}

export function StatusBadge({ status, large = false }: Props) {
  return (
    <span className={`badge badge--${TONES[status]} ${large ? "badge--lg" : ""}`}>
      {LABELS[status]}
    </span>
  );
}