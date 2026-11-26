import { BulbIcon } from './Icons';
import type { Metrics } from '../types';

interface Props {
  metrics: Metrics | null;
  rangeLabel: string;
  days: number;
}

/**
 * Throughput summary. Deliberately carries no chart: the completions chart
 * above already plots this period, and repeating it here would say the same
 * thing twice.
 */
export function KeyInsights({ metrics, rangeLabel, days }: Props) {
  const trend = metrics?.trend ?? 0;
  const perDay = metrics && days ? metrics.totalClosed / days : 0;
  const busiest = metrics?.daily.reduce(
    (a, b) => (!a || b.closed > a.closed ? b : a),
    metrics.daily[0],
  );
  const activeBuckets = metrics?.daily.filter((d) => d.closed > 0).length ?? 0;
  const grain = metrics?.grain === 'week' ? 'week' : 'day';

  const rows = [
    {
      k: `Average per ${grain}`,
      v: metrics
        ? (metrics.grain === 'week' ? perDay * 7 : perDay).toFixed(1)
        : '—',
    },
    {
      k: `Busiest ${grain}`,
      v: busiest && busiest.closed > 0 ? `${busiest.label} · ${busiest.closed}` : '—',
    },
    {
      k: `${grain === 'week' ? 'Weeks' : 'Days'} with activity`,
      v: metrics ? `${activeBuckets} of ${metrics.daily.length}` : '—',
    },
  ];

  return (
    <article className="card">
      <header className="chead">
        <div className="t">
          <BulbIcon />
          Throughput
        </div>
        <span className="clink">{rangeLabel}</span>
      </header>

      <div className="thru">
        <div className="thru-hero">
          <b style={{ color: trend >= 0 ? '#8fe0c0' : '#e3a2a2' }}>
            {metrics ? `${trend > 0 ? '+' : ''}${trend}%` : '—'}
          </b>
          <span>activity vs first half of period</span>
        </div>
        <dl className="thru-rows">
          {rows.map((r) => (
            <div key={r.k}>
              <dt>{r.k}</dt>
              <dd>{r.v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </article>
  );
}
