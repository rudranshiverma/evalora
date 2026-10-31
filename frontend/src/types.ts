export type StudentStatus = "queued" | "grading" | "done" | "failed";
export type RunStatus = "ready" | "running" | "completed";

export interface Criterion {
  name: string;
  max_points: number;
  description: string;
}

export interface RubricDraft {
  title: string;
  assignment_prompt: string;
  criteria: Criterion[];
}

export interface Rubric extends RubricDraft {
  id: string;
  created_at: string;
  max_total: number;
}

export interface Submission {
  student_id: string;
  student_name: string;
  filename: string;
  word_count: number;
  warning: string | null;
}

export interface CriterionResult {
  criterion: string;
  max_points: number;
  score: number;
  justification: string;
  evidence_quote: string;
  evidence_verified: boolean;
  strengths: string;
  improvements: string;
}

export interface StudentResult {
  student_id: string;
  student_name: string;
  status: StudentStatus;
  criteria: CriterionResult[];
  total: number | null;
  max_total: number;
  overall_feedback: string;
  flags: string[];
  confidence: number | null;
  model: string | null;
  graded_at: string | null;
  error: string | null;
}

export interface Run {
  id: string;
  rubric: Rubric;
  submissions: Submission[];
  status: RunStatus;
  model: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface RunSummary {
  id: string;
  title: string;
  status: RunStatus;
  model: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  total: number;
  done: number;
  failed: number;
  pending: number;
  average_total: number | null;
  max_total: number;
}

export interface RunDetail {
  run: Run;
  results: StudentResult[];
  summary: RunSummary;
}

export interface Health {
  status: string;
  mock_grader: boolean;
  model: string;
  api_key_set: boolean;
}
