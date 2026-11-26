import type {
  DayBucket,
  Issue,
  Measure,
  Metrics,
  Move,
  MoveKind,
  ProjectRow,
  StatusCategory,
} from '../types';

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

export function buildMetrics(
  issues: Issue[],
  days: number,
  lookup: Record<string, string> = {},
  measure: Measure = 'moved',
): Metrics {
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
        weighted: 0,
        atRisk: false,
        last: 0,
      };
      byProject.set(issue.projectKey, row);
    }
    row[category] += 1;
    row.total += 1;

    if (issue.updated) {
      const t = new Date(issue.updated).getTime();
      if (t > row.last) row.last = t;
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

  const moves = buildMoves(issues, days, lookup);

  // When each project last had a status change — a better risk signal than
  // completion rate, because a team using "For review" as its final column
  // would otherwise sit permanently at 0% done and read as At Risk forever.
  const lastMove = new Map<string, number>();
  for (const m of moves) {
    const t = new Date(m.at).getTime();
    if (t > (lastMove.get(m.projectKey) ?? 0)) lastMove.set(m.projectKey, t);
  }
  const STALE_MS = 14 * 86_400_000;

  const projects = [...byProject.values()]
    .map((p) => {
      p.pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
      // Started work is real work. A team whose final column is "For review"
      // would otherwise sit at 0% forever, which is what the Done-only bar did.
      p.weighted = p.total
        ? Math.round(((p.done + p.progress * 0.5) / p.total) * 100)
        : 0;
      const since = lastMove.get(p.key) ?? p.last;
      const stale = since ? Date.now() - since > STALE_MS : true;
      // Flagged when something is overdue, or nothing has moved in a fortnight.
      p.atRisk = p.overdue > 0 || stale;
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

  const { daily, grain } = buildDaily(moves, days, measure);
  const totalClosed = daily.reduce((a, b) => a + b.closed, 0);

  const kindTotals: Record<MoveKind, number> = {
    started: 0, advanced: 0, completed: 0, reopened: 0, back: 0,
  };
  for (const m of moves) kindTotals[m.kind] += 1;

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
    moves,
    kindTotals,
    hasHistory: issues.some((i) => (i.transitions?.length ?? 0) > 0),
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

/* ----------------------------------------------------- status movement --- */

/** Local YYYY-MM-DD, so buckets line up with the viewer's calendar. */
function localKey(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Classify a status name into a category.
 *
 * The changelog gives status *names* only, so we first consult the lookup the
 * server built from statuses actually present on this site — that is how
 * "For review" and "CLARIFICATION" resolve correctly. The regexes are only a
 * fallback for a status no current issue happens to sit in.
 */
export function categoryOfStatus(
  name: string,
  lookup: Record<string, string>,
): StatusCategory {
  const known = lookup[name];
  if (known) {
    if (/done|complete/i.test(known)) return 'done';
    if (/progress/i.test(known)) return 'progress';
    return 'todo';
  }
  if (/^(done|closed|complete|resolved|shipped|released)/i.test(name)) return 'done';
  if (/(progress|review|testing|qa|clarif|doing|dev|blocked|hold)/i.test(name)) return 'progress';
  return 'todo';
}

export function classifyMove(
  from: string,
  to: string,
  lookup: Record<string, string>,
): MoveKind {
  const a = categoryOfStatus(from, lookup);
  const b = categoryOfStatus(to, lookup);
  if (b === 'done') return 'completed';
  if (a === 'done') return 'reopened';
  if (a === 'todo' && b === 'progress') return 'started';
  if (b === 'todo') return 'back';
  return 'advanced';
}

/** Flatten every status change in the window into a single ordered list. */
export function buildMoves(
  issues: Issue[],
  days: number,
  lookup: Record<string, string>,
): Move[] {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  const from = start.getTime();

  const moves: Move[] = [];
  for (const issue of issues) {
    for (const t of issue.transitions || []) {
      const at = new Date(t.at).getTime();
      if (Number.isNaN(at) || at < from) continue;
      moves.push({
        ...t,
        kind: classifyMove(t.from, t.to, lookup),
        issueKey: issue.key,
        summary: issue.summary,
        projectKey: issue.projectKey,
        projectName: issue.projectName,
      });
    }
  }
  moves.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return moves;
}

export function matchesMeasure(kind: MoveKind, measure: Measure): boolean {
  if (measure === 'completed') return kind === 'completed';
  if (measure === 'started') return kind === 'started';
  return true; // 'moved' counts every status change
}

export function buildDaily(
  moves: Move[],
  days: number,
  measure: Measure,
): { daily: DayBucket[]; grain: 'day' | 'week' } {
  // Past a quarter, one column per day stops being readable.
  const grain: 'day' | 'week' = days > 90 ? 'week' : 'day';
  const step = grain === 'week' ? 7 : 1;

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  const buckets: DayBucket[] = [];
  const index = new Map<string, DayBucket>();

  for (let offset = 0; offset < days; offset += step) {
    const d = new Date(start);
    d.setDate(start.getDate() + offset);
    const bucket: DayBucket = {
      date: localKey(d),
      label: d.toLocaleString('en-US', { day: 'numeric', month: 'short' }),
      closed: 0,
      byProject: {},
      moves: [],
    };
    buckets.push(bucket);
    for (let k = 0; k < step; k++) {
      const inner = new Date(d);
      inner.setDate(d.getDate() + k);
      index.set(localKey(inner), bucket);
    }
  }

  for (const move of moves) {
    if (!matchesMeasure(move.kind, measure)) continue;
    const bucket = index.get(localKey(new Date(move.at)));
    if (!bucket) continue;
    bucket.closed += 1;
    bucket.byProject[move.projectKey] = (bucket.byProject[move.projectKey] || 0) + 1;
    bucket.moves.push(move);
  }

  return { daily: buckets, grain };
}
