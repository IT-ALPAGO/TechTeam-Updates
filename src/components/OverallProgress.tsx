import { Donut } from './Charts';
import { TrendIcon } from './Icons';
import type { Metrics } from '../types';

export function OverallProgress({ metrics }: { metrics: Metrics | null }) {
  const totals = metrics?.totals ?? { done: 0, progress: 0, todo: 0 };

  const legend = [
    { label: 'Completed', value: totals.done, color: 'var(--green)' },
    { label: 'In Progress', value: totals.progress, color: 'var(--blue)' },
    { label: 'To Do', value: totals.todo, color: '#8d939b' },
  ];

  return (
    <article className="card">
      <header className="chead">
        <div className="t">
          <TrendIcon />
          Overall Progress
        </div>
      </header>

      <div className="prog">
        <div className="donut">
          <Donut
            segments={[
              { value: totals.done, color: '#5ad1a5', label: 'Completed' },
              { value: totals.progress, color: '#6aa8f5', label: 'In Progress' },
              { value: totals.todo, color: '#8d939b', label: 'To Do' },
            ]}
          />
          <div className="mid">
            <b>{metrics ? `${metrics.pct}%` : '—'}</b>
            <span>Overall</span>
          </div>
        </div>

        <div className="legend">
          {legend.map((l) => (
            <div className="lg" key={l.label}>
              <i style={{ background: l.color }} />
              <div>
                <div className="k">{l.label}</div>
                <div className="v">{metrics ? l.value : '—'}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}
