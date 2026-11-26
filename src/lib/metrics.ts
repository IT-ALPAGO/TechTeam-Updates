import type { DayBucket, Issue, Metrics, ProjectRow, StatusCategory } from '../types';

/**
 * Jira sites customise status names freely — this site alone uses
 * "For review", "CLARIFICATION" and "TASKS TO DO". Status *categories*
 * are fixed by Jira, so bucket on those and every custom status lands
 * in the right column automatically.
 */
export function toCategory(issue: Issue): StatusCategory {
  const c = issue.category || '';
  if (/done|complete/i.test(c)) return 'done';
  if (/progress/i.test(c)) return 'progress';
  return 'todo';
}

const BLOCKED_RE = /block|on hold|clarif|impedi|waiting|pending/i;

export function isBlocked(issue: Issue): boolean {
  return BLOCKED_RE.test(issue.status);
}

/** Number of histogram columns for a window — one per day, capped at 60. */
function bucketCount(days: number): number {
  return Math.max(7, Math.min(days, 60));
}

export function buildMetrics(issues: Issue[], days: number): Metrics {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totals: Record<StatusCategory, number> = { done: 0, progress: 0, todo: 0 };
  const byProject = new Map<string, ProjectRow>();
  const overdue: Issue[] = [];
  const blocked: Issue[] = [];

  const span = bucketCount(days);
  const buckets = new Array<number>(span).fill(0);
  const windowStart = Date.now() - days * 86_400_000;
  const msPerBucket = (days * 86_400_000) / span;

  for (const issue of issues) {
    const category = toCategory(issue);
    totals[category] += 1;

    let row = byProject.get(issue.projectKey);
    if (!row) {
      row = {
        key: issue.projectKey,
        name: issue.projectName,
        done: 0,
        progress: 0,
        todo: 0,
        total: 0,
        overdue: 0,
        pct: 0,
        atRisk: false,
      };
      byProject.set(issue.projectKey, row);
    }
    row[category] += 1;
    row.total += 1;

    if (issue.updated) {
      const t = new Date(issue.updated).getTime();
      if (t >= windowStart) {
        const i = Math.floor((t - windowStart) / msPerBucket);
        if (i >= 0 && i < span) buckets[i] += 1;
      }
    }

    if (issue.dueDate && category !== 'done') {
      const due = new Date(`${issue.dueDate}T00:00:00`);
      if (due < today) {
        row.overdue += 1;
        overdue.push(issue);
      }
    }

    if (category !== 'done' && isBlocked(issue)) blocked.push(issue);
  }

  const projects = [...byProject.values()]
    .map((p) => {
      p.pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
      // A project is flagged when something is past its due date, or when
      // fewer than half its touched items have landed.
      p.atRisk = p.overdue > 0 || p.pct < 50;
      return p;
    })
    .sort((a, b) => b.total - a.total);

  const total = totals.done + totals.progress + totals.todo;
  const half = Math.floor(span / 2);
  const firstHalf = buckets.slice(0, half).reduce((a, b) => a + b, 0);
  const secondHalf = buckets.slice(half).reduce((a, b) => a + b, 0);
  const trend = firstHalf
    ? Math.round(((secondHalf - firstHalf) / firstHalf) * 100)
    : secondHalf
      ? 100
      : 0;

  const { daily, grain } = buildDaily(issues, days);
  const totalClosed = daily.reduce((a, b) => a + b.closed, 0);

  const closedTally = new Map<string, { key: string; name: string; closed: number }>();
  for (const b of daily) {
    for (const [key, n] of Object.entries(b.byProject)) {
      const row = closedTally.get(key) || {
        key,
        name: byProject.get(key)?.name || key,
        closed: 0,
      };
      row.closed += n;
      closedTally.set(key, row);
    }
  }
  const closedByProject = [...closedTally.values()].sort((a, b) => b.closed - a.closed);

  return {
    issues,
    projects,
    daily,
    grain,
    closedByProject,
    totalClosed,
    totals,
    total,
    pct: total ? Math.round((totals.done / total) * 100) : 0,
    overdue,
    blocked,
    buckets,
    trend,
    firstHalf,
    secondHalf,
  };
}

/* ------------------------------------------------------------- formatting */

export function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function formatStamp(date: Date): string {
  try {
    return (
      date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Dubai',
      }) + ' (GST)'
    );
  } catch {
    return date.toISOString();
  }
}

/* ------------------------------------------------- daily completions ----- */

/** Local YYYY-MM-DD, so buckets line up with the viewer's calendar. */
function localKey(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * When an issue was completed. Jira sets `resolutiondate` when a resolution is
 * applied, but team-managed projects often move an issue to a Done status
 * without one — so fall back to `updated` for anything in the Done category.
 */
export function closedAt(issue: Issue): Date | null {
  if (issue.resolved) return new Date(issue.resolved);
  if (toCategory(issue) === 'done' && issue.updated) return new Date(issue.updated);
  return null;
}

export function buildDaily(
  issues: Issue[],
  days: number,
): { daily: DayBucket[]; grain: 'day' | 'week' } {
  // Past a quarter, one column per day stops being readable.
  const grain: 'day' | 'week' = days > 90 ? 'week' : 'day';
  const step = grain === 'week' ? 7 : 1;

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  // Align weekly buckets to the window start, not to an arbitrary weekday.
  const buckets: DayBucket[] = [];
  const index = new Map<string, DayBucket>();

  for (let offset = 0; offset < days; offset += step) {
    const d = new Date(start);
    d.setDate(start.getDate() + offset);
    const bucket: DayBucket = {
      date: localKey(d),
      label:
        grain === 'week'
          ? `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}`
          : d.toLocaleString('en-US', { day: 'numeric', month: 'short' }),
      closed: 0,
      byProject: {},
      issues: [],
    };
    buckets.push(bucket);
    // Map every day in the step onto this bucket.
    for (let k = 0; k < step; k++) {
      const inner = new Date(d);
      inner.setDate(d.getDate() + k);
      index.set(localKey(inner), bucket);
    }
  }

  for (const issue of issues) {
    const when = closedAt(issue);
    if (!when) continue;
    const bucket = index.get(localKey(when));
    if (!bucket) continue;
    bucket.closed += 1;
    bucket.byProject[issue.projectKey] = (bucket.byProject[issue.projectKey] || 0) + 1;
    bucket.issues.push(issue);
  }

  for (const b of buckets) {
    b.issues.sort((x, y) => (closedAt(y)?.getTime() || 0) - (closedAt(x)?.getTime() || 0));
  }

  return { daily: buckets, grain };
}
