import { useEffect, useState } from "react";
import { api } from "../api";
import { AutoTextarea } from "../components/AutoTextarea";
import { ChartIcon, DocIcon, ListIcon, PlusIcon, XIcon } from "../components/Icons";
import { PageHead } from "../components/PageHead";
import { Panel } from "../components/Panel";
import { RubricSummary } from "../components/RubricSummary";
import { formatScore, plural } from "../format";
import {
  emptyCriterion,
  maxTotal,
  type RubricErrors,
  SAMPLE_RUBRIC,
  validateRubric,
} from "../rubric";
import { navigate } from "../router";
import type { Criterion, Rubric, RubricDraft } from "../types";

let lastKey = 0;
const newKey = () => ++lastKey;

interface Notice {
  tone: "info" | "error";
  text: string;
}

interface Props {
  draft: RubricDraft;
  onChange: (draft: RubricDraft) => void;
}

export function RubricPage({ draft, onChange }: Props) {
  const [keys, setKeys] = useState(() => draft.criteria.map(newKey));
  const [errors, setErrors] = useState<RubricErrors | null>(null);
  const [saved, setSaved] = useState<Rubric[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .listRubrics()
      .then(setSaved)
      .catch(() => setSaved([]));
  }, []);

  const update = (next: RubricDraft) => {
    onChange(next);
    if (errors) setErrors(validateRubric(next));
  };

  const replaceDraft = (next: RubricDraft) => {
    setKeys(next.criteria.map(newKey));
    setErrors(null);
    onChange(next);
  };

  const setCriterion = (index: number, patch: Partial<Criterion>) =>
    update({
      ...draft,
      criteria: draft.criteria.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    });

  const addCriterion = () => {
    setKeys([...keys, newKey()]);
    update({ ...draft, criteria: [...draft.criteria, emptyCriterion()] });
  };

  const removeCriterion = (index: number) => {
    setKeys(keys.filter((_, i) => i !== index));
    update({ ...draft, criteria: draft.criteria.filter((_, i) => i !== index) });
  };

  const loadSaved = (id: string) => {
    const rubric = saved.find((r) => r.id === id);
    if (!rubric) return;
    replaceDraft({
      title: rubric.title,
      assignment_prompt: rubric.assignment_prompt,
      criteria: rubric.criteria.map((c) => ({ ...c })),
    });
    setNotice({ tone: "info", text: `Loaded "${rubric.title}".` });
  };

  const save = async () => {
    const found = validateRubric(draft);
    setErrors(found);
    if (found) return;
    setSaving(true);
    try {
      const rubric = await api.saveRubric(draft);
      setSaved([rubric, ...saved]);
      setNotice({ tone: "info", text: "Rubric saved. You can load it again for future batches." });
    } catch (e) {
      setNotice({ tone: "error", text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const proceed = () => {
    const found = validateRubric(draft);
    setErrors(found);
    if (!found) navigate("/upload");
  };

  const actions = (
    <>
      {saved.length > 0 && (
        <select
          className="select"
          value=""
          onChange={(e) => loadSaved(e.target.value)}
          aria-label="Load a saved rubric"
        >
          <option value="">Load a saved rubric</option>
          {saved.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </select>
      )}
      <button className="btn btn--soft" onClick={() => replaceDraft(SAMPLE_RUBRIC)}>
        Use sample
      </button>
    </>
  );

  return (
    <>
      <PageHead
        title="Build the rubric"
        subtitle="Describe the assignment and how each criterion is scored. Every grade Evalora gives is checked against this."
        actions={actions}
        step={0}
      />
      <div className="container stack">
        {notice && <div className={`alert alert--${notice.tone}`}>{notice.text}</div>}
        <div className="layout">
          <div className="stack">
            <Panel
              icon={<DocIcon />}
              title="Assignment details"
              description="What students were asked to do."
            >
              <div className="panel__body">
                <div className="field">
                  <label className="label" htmlFor="rubric-title">
                    Rubric title
                  </label>
                  <input
                    id="rubric-title"
                    className={`input ${errors?.title ? "input--invalid" : ""}`}
                    value={draft.title}
                    maxLength={200}
                    placeholder="e.g. Argumentative essay"
                    onChange={(e) => update({ ...draft, title: e.target.value })}
                  />
                  {errors?.title && <span className="field-error">{errors.title}</span>}
                </div>
                <div className="field">
                  <label className="label" htmlFor="rubric-prompt">
                    Assignment question <span className="label__opt">(optional)</span>
                  </label>
                  <AutoTextarea
                    id="rubric-prompt"
                    className="textarea textarea--tall"
                    value={draft.assignment_prompt}
                    placeholder="Paste the question students answered"
                    onChange={(e) => update({ ...draft, assignment_prompt: e.target.value })}
                  />
                  <span className="hint">Including the question helps the grader judge relevance.</span>
                </div>
              </div>
            </Panel>

            <Panel
              icon={<ListIcon />}
              title="Criteria"
              description="Each criterion is scored separately, with evidence from the submission."
              meta={
                <span className="badge badge--info badge--lg">
                  {plural(draft.criteria.length, "criterion", "criteria")},{" "}
                  {formatScore(maxTotal(draft))} points
                </span>
              }
            >
              <div className="crit-table">
                <div className="crit-table__head">
                  <span>Criterion</span>
                  <span>Max points</span>
                  <span>What earns full marks</span>
                  <span />
                </div>
                {draft.criteria.map((c, i) => {
                  const rowErrors = errors?.criteria[i];
                  return (
                    <div className="crit-table__row" key={keys[i]}>
                      <div className="crit-table__cell">
                        <input
                          className={`input ${rowErrors?.name ? "input--invalid" : ""}`}
                          value={c.name}
                          maxLength={120}
                          placeholder="e.g. Use of evidence"
                          aria-label={`Criterion ${i + 1} name`}
                          onChange={(e) => setCriterion(i, { name: e.target.value })}
                        />
                        {rowErrors?.name && <span className="field-error">{rowErrors.name}</span>}
                      </div>
                      <div className="crit-table__cell">
                        <div className="points">
                          <input
                            className={`input ${rowErrors?.max_points ? "input--invalid" : ""}`}
                            type="number"
                            min={0.5}
                            step={0.5}
                            value={c.max_points === 0 ? "" : c.max_points}
                            aria-label={`Criterion ${i + 1} max points`}
                            onChange={(e) =>
                              setCriterion(i, {
                                max_points: e.target.value === "" ? 0 : Number(e.target.value),
                              })
                            }
                          />
                          <span className="points__suffix">pts</span>
                        </div>
                        {rowErrors?.max_points && (
                          <span className="field-error">{rowErrors.max_points}</span>
                        )}
                      </div>
                      <AutoTextarea
                        className="textarea"
                        value={c.description}
                        placeholder="Describe a full-marks answer"
                        aria-label={`Criterion ${i + 1} description`}
                        onChange={(e) => setCriterion(i, { description: e.target.value })}
                      />
                      <button
                        className="icon-btn"
                        onClick={() => removeCriterion(i)}
                        disabled={draft.criteria.length === 1}
                        aria-label={`Remove criterion ${i + 1}`}
                        title="Remove criterion"
                      >
                        <XIcon />
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="add-row">
                <button className="btn btn--dashed" onClick={addCriterion}>
                  <PlusIcon />
                  Add criterion
                </button>
              </div>
            </Panel>

            {errors?.general && <div className="alert alert--error">{errors.general}</div>}
          </div>

          <aside className="aside">
            <Panel icon={<ChartIcon />} title="Rubric summary" description="How the marks are weighted.">
              <div className="panel__body">
                <RubricSummary draft={draft} />
                <div className="summary__actions">
                  <button className="btn btn--primary btn--block" onClick={proceed}>
                    Continue to upload
                  </button>
                  <button className="btn btn--block" onClick={save} disabled={saving}>
                    {saving ? "Saving..." : "Save rubric"}
                  </button>
                </div>
              </div>
            </Panel>
          </aside>
        </div>
      </div>
    </>
  );
}