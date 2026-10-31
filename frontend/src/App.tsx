import { useEffect, useState } from "react";
import { api } from "./api";
import { type HealthState, TopBar } from "./components/TopBar";
import { RubricPage } from "./pages/RubricPage";
import { RunPage } from "./pages/RunPage";
import { RunsPage } from "./pages/RunsPage";
import { UploadPage } from "./pages/UploadPage";
import { useRoute } from "./router";
import { loadDraft, saveDraft } from "./rubric";
import type { RubricDraft } from "./types";

export default function App() {
  const route = useRoute();
  const [health, setHealth] = useState<HealthState>(null);
  const [draft, setDraft] = useState<RubricDraft>(loadDraft);

  useEffect(() => {
    api
      .health()
      .then(setHealth)
      .catch(() => setHealth("offline"));
  }, []);

  useEffect(() => saveDraft(draft), [draft]);

  const section = route.page === "rubric" || route.page === "upload" ? "new" : "past";

  return (
    <div className="app">
      <TopBar health={health} section={section} />
      <main>
        {route.page === "rubric" && <RubricPage draft={draft} onChange={setDraft} />}
        {route.page === "upload" && <UploadPage draft={draft} />}
        {route.page === "runs" && <RunsPage />}
        {route.page === "run" && <RunPage key={route.runId} runId={route.runId} />}
      </main>
    </div>
  );
}