import { AlertCircleIcon, ArrowRightIcon, WarnTriangleIcon } from './Icons';
import type { Issue, Metrics } from '../types';

interface Props {
  metrics: Metrics | null;
  loading: boolean;
  siteUrl: string;
}

function issueFilterUrl(site: string, issues: Issue[]): string | undefined {
  if (!issues.length) return undefined;
  const keys = issues.slice(0, 50).map((i) => i.key).join(',');
  return `${site}/issues/?jql=${encodeURIComponent(`key in (${keys})`)}`;
}

function Row({
  tone,
  count,
  label,
  sub,
  href,
}: {
  tone: 'red' | 'amb';
  count: number;
  label: string;
  sub: string;
  href?: string;
}) {
  const inner = (
    <>
      <div className="bg">
        <AlertCircleIcon />
      </div>
      <div className="tx">
        <b>
          {count} {label}
        </b>
        <span>{sub}</span>
      </div>
      <ArrowRightIcon className="ar" />
    </>
  );

  return href ? (
    <a className={`arow ${tone}`} href={href} target="_blank" rel="noopener noreferrer">
      {inner}
    </a>
  ) : (
    <div className={`arow ${tone}`}>{inner}</div>
  );
}

export function NeedsAttention({ metrics, loading, siteUrl }: Props) {
  const overdue = metrics?.overdue ?? [];
  const blocked = metrics?.blocked ?? [];
  const total = overdue.length + blocked.length;

  const projectsAffected = new Set(overdue.map((i) => i.projectKey)).size;

  return (
    <article className="card">
      <header className="chead">
        <div className="t">
          <WarnTriangleIcon />
          Needs Attention
        </div>
        <span className="clink">{loading ? '—' : `${total} item${total === 1 ? '' : 's'}`}</span>
      </header>

      <div className="att">
        {loading && <div className="empty">Loading…</div>}

        {!loading && total === 0 && (
          <div className="empty">Nothing needs attention — all clear.</div>
        )}

        {!loading && overdue.length > 0 && (
          <Row
            tone="red"
            count={overdue.length}
            label="Overdue Tasks"
            sub={`Across ${projectsAffected} project${projectsAffected === 1 ? '' : 's'}`}
            href={issueFilterUrl(siteUrl, overdue)}
          />
        )}

        {!loading && blocked.length > 0 && (
          <Row
            tone="amb"
            count={blocked.length}
            label="Blocked Tasks"
            sub="Require follow-up"
            href={issueFilterUrl(siteUrl, blocked)}
          />
        )}
      </div>
    </article>
  );
}
