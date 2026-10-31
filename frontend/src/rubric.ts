import type { Criterion, RubricDraft } from "./types";

const DRAFT_KEY = "evalora.rubricDraft";

export const SAMPLE_RUBRIC: RubricDraft = {
  title: "Argumentative essay",
  assignment_prompt:
    "Write a 500-word argumentative essay on a current issue. Take a clear position and support it with evidence.",
  criteria: [
    {
      name: "Thesis and argument",
      max_points: 10,
      description:
        "States a clear, arguable position early and develops it consistently through the essay.",
    },
    {
      name: "Evidence and support",
      max_points: 10,
      description:
        "Backs each main claim with specific, relevant evidence and explains how it supports the argument.",
    },
    {
      name: "Counterargument",
      max_points: 5,
      description: "Acknowledges at least one opposing view and responds to it convincingly.",
    },
    {
      name: "Organisation",
      max_points: 5,
      description: "Paragraphs follow a logical order with clear topic sentences and transitions.",
    },
    {
      name: "Language and mechanics",
      max_points: 5,
      description: "Clear, formal writing with few grammar, spelling or punctuation errors.",
    },
  ],
};

export function emptyCriterion(): Criterion {
  return { name: "", max_points: 5, description: "" };
}

export function maxTotal(draft: RubricDraft): number {
  return draft.criteria.reduce((sum, c) => sum + (c.max_points > 0 ? c.max_points : 0), 0);
}

export interface RubricErrors {
  title?: string;
  general?: string;
  criteria: { name?: string; max_points?: string }[];
}

export function validateRubric(draft: RubricDraft): RubricErrors | null {
  const errors: RubricErrors = { criteria: draft.criteria.map(() => ({})) };
  let invalid = false;
  if (!draft.title.trim()) {
    errors.title = "Give the rubric a title.";
    invalid = true;
  }
  if (draft.criteria.length === 0) {
    errors.general = "Add at least one criterion.";
    invalid = true;
  }
  const seen = new Set<string>();
  draft.criteria.forEach((c, i) => {
    const name = c.name.trim().toLowerCase();
    if (!name) {
      errors.criteria[i].name = "Required";
      invalid = true;
    } else if (seen.has(name)) {
      errors.criteria[i].name = "Duplicate name";
      invalid = true;
    }
    seen.add(name);
    if (!(c.max_points > 0)) {
      errors.criteria[i].max_points = "Must be above 0";
      invalid = true;
    }
  });
  return invalid ? errors : null;
}

export function loadDraft(): RubricDraft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return JSON.parse(raw) as RubricDraft;
  } catch {
    // Storage blocked or corrupted, start from the sample.
  }
  return SAMPLE_RUBRIC;
}

export function saveDraft(draft: RubricDraft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Storage blocked, the draft just won't survive a refresh.
  }
}
