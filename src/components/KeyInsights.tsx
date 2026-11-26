import { BulbIcon } from './Icons';
import type { Metrics } from '../types';

interface Props {
  metrics: Metrics | null;
  rangeLabel: string;
}

export function KeyInsights({ metrics, rangeLabel }: Props) {
  const buckets = metrics?.buckets ?? [];
  const max = Math.max(...buckets, 1);
  const highlightFrom = buckets.length - Math.ceil(buckets.length / 4);
  const trend = metrics?.trend ?? 0;

  return (
    <article className="card">
      <header className="chead">
        <div className="t">
          <BulbIcon />
          Key Insights
        </div>
        <span className="clink">{rangeLabel}</span>
      </header>

      <div className="ins">
        <div className="daybars" role="img" aria-label="Issue updates per day across the selected period">
          {buckets.map((v, i) => (
            <div
              key={i}
              className={`b${i >= highlightFrom ? ' hi' : ''}`}
              style={{ height: `${Math.max(3, (v / max) * 100)}%` }}
              title={`${v} update${v === 1 ? '' : 's'}`}
            />
          ))}
          {buckets.length === 0 && <div className="empty">No activity data.</div>}
        </div>

        <div className="big">
          <b style={{ color: trend >= 0 ? '#8fe0c0' : '#e3a2a2' }}>
            {metrics ? `${trend > 0 ? '+' : ''}${trend}%` : '—'}
          </b>
          <span>vs first half of period</span>
        </div>
      </div>
    </article>
  );
}
