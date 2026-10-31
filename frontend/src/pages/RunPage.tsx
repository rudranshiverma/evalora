import { useCallback, useEffect, useState } from "react";
import { api, streamRun } from "../api";
import { BatchView } from "../components/BatchView";
import { ReviewPanel } from "../components/ReviewPanel";
import { upsert } from "../results";
import type { RunDetail } from "../types";

export function RunPage({ runId }: { runId: string }) {
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(true);

  const load = useCallback(() => {
    api
      .getRun(runId)
      .then(setDetail)
      .catch((e: Error) => setError(e.message));
  }, [runId]);

  useEffect(load, [load]);

  const status = detail?.run.status;

  useEffect(() => {
    if (status !== "running") return;
    return streamRun(runId, {
      onSnapshot: setDetail,
      onStudent: (result) =>
        setDetail((prev) => prev && { ...prev, results: upsert(prev.results, result) }),
      onDone: load,
      onConnectionChange: setConnected,
    });
  }, [runId, status, load]);

  const retry = async (studentId: string) => {
    const result = await api.retryStudent(runId, studentId);
    setDetail(
      (prev) =>
        prev && {
          ...prev,
          run: { ...prev.run, status: "running" },
          results: upsert(prev.results, result),
        },
    );
  };

  if (error) {
    return (
      <div className="container">
        <div className="alert alert--error">
          {error} <a href="#/runs">Back to past batches</a>
        </div>
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="container">
        <p className="muted">Loading...</p>
      </div>
    );
  }
  if (detail.run.status === "ready") return <ReviewPanel detail={detail} onStarted={load} />;
  return <BatchView detail={detail} connected={connected} onRetry={retry} />;
}