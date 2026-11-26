export type StatusCategory = 'done' | 'progress' | 'todo';

/** What a status change meant, in plain terms. */
export type MoveKind = 'started' | 'advanced' | 'completed' | 'reopened' | 'back';

export interface Transition {
  at: string;
  from: string;
  to: string;
  by: string | null;
}

/** One status change, flattened and attached to its issue. */
export interface Move extends Transition {
  kind: MoveKind;
  issueKey: string;
  summary: string;
  projectKey: string;
  projectName: string;
}

/** Which measure the daily chart is plotting. */
export type Measure = 'moved' | 'started' | 'completed';

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
  transitions: Transition[];
}

export interface IssuesResponse {
  days: number;
  fetchedAt: string;
  truncated: boolean;
  withChangelog: boolean;
  statusCategories: Record<string, string>;
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
  /** Share of work finished (Done only). */
  pct: number;
  /** Share of work under way or finished: in-progress counts half. */
  weighted: number;
  atRisk: boolean;
  /** Most recent `updated` seen for this project, as a fallback risk signal. */
  last: number;
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
  /** Projects contributing to the current measure, busiest first. */
  closedByProject: { key: string; name: string; closed: number }[];
  totalClosed: number;
  /** Every status change inside the window, newest first. */
  moves: Move[];
  /** Totals per kind, for the whole window. */
  kindTotals: Record<MoveKind, number>;
  /** True when Jira returned issue history. */
  hasHistory: boolean;
}

export interface DayBucket {
  /** YYYY-MM-DD in the viewer's local time. */
  date: string;
  label: string;
  /** Count for the measure currently plotted. */
  closed: number;
  byProject: Record<string, number>;
  moves: Move[];
}

export interface Range {
  id: string;
  label: string;
  days: number;
}
