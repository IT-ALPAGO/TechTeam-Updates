export type StatusCategory = 'done' | 'progress' | 'todo';

/** An issue as the proxy hands it to the browser. */
export interface Issue {
  key: string;
  summary: string;
  status: string;
  category: string; // raw Jira status category name
  projectKey: string;
  projectName: string;
  dueDate: string | null;
  updated: string | null;
  created: string | null;
  resolved: string | null;
  assignee: string | null;
  priority: string | null;
  issueType: string | null;
}

export interface IssuesResponse {
  days: number;
  fetchedAt: string;
  truncated: boolean;
  count: number;
  issues: Issue[];
}

export interface ProjectRow {
  key: string;
  name: string;
  done: number;
  progress: number;
  todo: number;
  total: number;
  overdue: number;
  pct: number;
  atRisk: boolean;
}

export interface Metrics {
  issues: Issue[];
  projects: ProjectRow[];
  totals: Record<StatusCategory, number>;
  total: number;
  pct: number;
  overdue: Issue[];
  blocked: Issue[];
  /** Activity histogram across the selected window. */
  buckets: number[];
  /** Percentage change, second half of the window vs the first. */
  trend: number;
  firstHalf: number;
  secondHalf: number;
  /** Completions per day (or per week for long ranges). */
  daily: DayBucket[];
  /** Bucket width actually used. */
  grain: 'day' | 'week';
  /** Projects with completions, busiest first. */
  closedByProject: { key: string; name: string; closed: number }[];
  totalClosed: number;
}

export interface DayBucket {
  /** YYYY-MM-DD in the viewer's local time. */
  date: string;
  label: string;
  closed: number;
  byProject: Record<string, number>;
  issues: Issue[];
}

export interface Range {
  id: string;
  label: string;
  days: number;
}
