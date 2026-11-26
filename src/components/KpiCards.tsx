import { Ring, Sparkline } from './Charts';
import { CheckCircleIcon, ClockIcon, FolderIcon } from './Icons';
import type { Metrics } from '../types';

interface Props {
  metrics: Metrics | null;
  loading: boolean;
}

function Value({ children, loading }: { children: React.ReactNode; loading: boolean }) {
  return <div className={`val${loading ? ' sk' : ''}`}>{loading ? '00' : children}</div>;
}

export function KpiCards({ metrics, loading }: Props) {
  const buckets = metrics?.buckets ?? [];
  const delta = metrics ? metrics.secondHalf - metrics.firstHalf : 0;
  const deltaClass = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const deltaText =
    delta > 0 ? `↑ +${delta} updates` : delta < 0 ? `↓ ${Math.abs(delta)} updates` : '– no change';

  return (
    <section className="kpis">
      <article className="card kpi">
        <div className="ico">
          <FolderIcon />
        </div>
        <div className="body">
          <Value loading={loading}>{metrics?.projects.length ?? 0}</Value>
          <div className="lbl">Active Projects</div>
          <div className="delta flat">with activity in range</div>
        </div>
        <Sparkline className="spark" values={buckets} />
      </article>

      <article className="card kpi">
        <div className="ico">
          <CheckCircleIcon />
        </div>
        <div className="body">
          <Value loading={loading}>{metrics?.total ?? 0}</Value>
          <div className="lbl">Total Tasks</div>
          <div className={`delta ${deltaClass}`}>{deltaText}</div>
        </div>
        <Sparkline className="spark" values={buckets} />
      </article>

      <article className="card kpi donutkpi">
        <Ring className="ring" pct={metrics?.pct ?? 0} />
        <div className="body">
          <Value loading={loading}>{`${metrics?.pct ?? 0}%`}</Value>
          <div className="lbl">Completed</div>
          <div className="delta flat">{metrics ? `${metrics.totals.done} of ${metrics.total}` : '—'}</div>
        </div>
        <Sparkline className="spark" values={buckets} fill="rgba(90,209,165,.07)" />
      </article>

      <article className="card kpi">
        <div className="ico">
          <ClockIcon />
        </div>
        <div className="body">
          <Value loading={loading}>{metrics?.totals.progress ?? 0}</Value>
          <div className="lbl">In Progress</div>
          <div className="delta flat">{metrics ? `${metrics.totals.todo} to do` : '—'}</div>
        </div>
        <Sparkline className="spark" values={buckets} />
      </article>
    </section>
  );
}
