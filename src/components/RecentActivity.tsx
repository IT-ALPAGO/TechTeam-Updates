import { BoltIcon } from './Icons';
import { timeAgo } from '../lib/metrics';
import type { Issue } from '../types';

interface Props {
  issues: Issue[];
  loading: boolean;
  siteUrl: string;
  limit?: number;
}

export function RecentActivity({ issues, loading, siteUrl, limit = 7 }: Props) {
  const recent = issues.slice(0, limit);

  return (
    <article className="card">
      <header className="chead">
        <div className="t">
          <BoltIcon />
          Recent Activity
        </div>
        <span className="clink">{loading ? '—' : `latest ${recent.length}`}</span>
      </header>

      <div className="acts">
        {loading && <div className="empty">Loading…</div>}
        {!loading && recent.length === 0 && (
          <div className="empty">No updates in this period.</div>
        )}

        {recent.map((issue, i) => (
          <a
            key={issue.key}
            className={`act${i < 2 ? ' new' : ''}`}
            href={`${siteUrl}/browse/${encodeURIComponent(issue.key)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="d" />
            <span className="t">
              <strong>{issue.key}</strong> {issue.status} — {issue.summary}
            </span>
            <span className="ago">{timeAgo(issue.updated)}</span>
          </a>
        ))}
      </div>
    </article>
  );
}
