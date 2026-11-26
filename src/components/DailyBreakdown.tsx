import { useEffect, useMemo, useState } from 'react';
import { BarsIcon } from './Icons';
import { closedAt, timeAgo } from '../lib/metrics';
import {
  MAX_SERIES,
  OTHER_COLOR,
  OTHER_KEY,
  colorFor,
  registerProjects,
} from '../lib/projectColors';
import type { DayBucket, Metrics } from '../types';

interface Props {
  metrics: Metrics | null;
  loading: boolean;
  siteUrl: string;
  rangeLabel: string;
}

export function DailyBreakdown({ metrics, loading, siteUrl, rangeLabel }: Props) {
  const [picked, setPicked] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);

  // Reset the drill-down when the underlying window changes.
  useEffect(() => setPicked(null), [rangeLabel]);

  const series = useMemo(() => {
    if (!metrics) return [];
    registerProjects(metrics.closedByProject.map((p) => p.key));
    const top = metrics.closedByProject.slice(0, MAX_SERIES);
    const rest = metrics.closedByProject.slice(MAX_SERIES);
    const out = top.map((p) => ({ key: p.key, name: p.name, closed: p.closed, color: colorFor(p.key) }));
    if (rest.length) {
      out.push({
        key: OTHER_KEY,
        name: `Other (${rest.length})`,
        closed: rest.reduce((a, b) => a + b.closed, 0),
        color: OTHER_COLOR,
      });
    }
    return out;
  }, [metrics]);

  const keyed = useMemo(() => new Set(series.map((s) => s.key)), [series]);
  const daily = metrics?.daily ?? [];
  const max = Math.max(...daily.map((d) => d.closed), 1);
  const grainWord = metrics?.grain === 'week' ? 'week' : 'day';

  const selected = daily.find((d) => d.date === picked) ?? null;
  const best = daily.reduce<DayBucket | null>(
    (a, b) => (!a || b.closed > a.closed ? b : a),
    null,
  );

  // Label roughly eight ticks, never every column.
  const tickEvery = Math.max(1, Math.ceil(daily.length / 8));

  function segmentsFor(bucket: DayBucket) {
    return series
      .map((s) => ({
        ...s,
        n:
          s.key === OTHER_KEY
            ? Object.entries(bucket.byProject)
                .filter(([k]) => !keyed.has(k))
                .reduce((a, [, v]) => a + v, 0)
            : bucket.byProject[s.key] || 0,
      }))
      .filter((s) => s.n > 0);
  }

  return (
    <article className="card daily">
      <header className="chead">
        <div className="t">
          <BarsIcon />
          Completed per {grainWord}
        </div>
        <div className="dhead-right">
          <span className="clink">
            {loading ? '—' : `${metrics?.totalClosed ?? 0} closed · ${rangeLabel}`}
          </span>
          <button
            type="button"
            className="tbtn"
            onClick={() => setShowTable((v) => !v)}
            aria-pressed={showTable}
          >
            {showTable ? 'Chart' : 'Table'}
          </button>
        </div>
      </header>

      {loading && <div className="empty">Loading completions…</div>}

      {!loading && metrics && metrics.totalClosed === 0 && (
        <div className="empty">Nothing was completed in this period.</div>
      )}

      {!loading && metrics && metrics.totalClosed > 0 && !showTable && (
        <>
          <div className="chart">
            <div className="yaxis" aria-hidden="true">
              <span>{max}</span>
              <span>{Math.round(max / 2)}</span>
              <span>0</span>
            </div>

            <div className="plot">
              <div className="grid" aria-hidden="true">
                <i /><i /><i />
              </div>

              <div className="cols">
                {daily.map((bucket, i) => {
                  const segs = segmentsFor(bucket);
                  const isSel = picked === bucket.date;
                  return (
                    <button
                      key={bucket.date}
                      type="button"
                      className={`col${isSel ? ' sel' : ''}${bucket.closed === 0 ? ' zero' : ''}`}
                      onClick={() => setPicked(isSel ? null : bucket.date)}
                      aria-label={`${bucket.label}: ${bucket.closed} completed`}
                      title={
                        `${bucket.label} — ${bucket.closed} closed` +
                        (segs.length
                          ? `\n${segs.map((s) => `${s.name}: ${s.n}`).join('\n')}`
                          : '')
                      }
                    >
                      <span className="stack">
                        {segs.map((s, idx) => (
                          <span
                            key={s.key}
                            className={`seg${idx === 0 ? ' top' : ''}`}
                            style={{
                              height: `${(s.n / max) * 100}%`,
                              background: s.color,
                            }}
                          />
                        ))}
                      </span>
                      <span className="tick">
                        {i % tickEvery === 0 ? bucket.label : ' '}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="legend-row">
            {series.map((s) => (
              <span className="chip" key={s.key}>
                <i style={{ background: s.color }} />
                {s.name}
                <b>{s.closed}</b>
              </span>
            ))}
          </div>
        </>
      )}

      {!loading && metrics && metrics.totalClosed > 0 && showTable && (
        <div className="dtable-wrap">
          <table className="dtable">
            <thead>
              <tr>
                <th>{grainWord === 'week' ? 'Week of' : 'Date'}</th>
                <th>Closed</th>
                <th>Projects</th>
              </tr>
            </thead>
            <tbody>
              {daily
                .filter((d) => d.closed > 0)
                .reverse()
                .map((d) => (
                  <tr key={d.date}>
                    <td>{d.label}</td>
                    <td>{d.closed}</td>
                    <td>
                      {segmentsFor(d)
                        .map((s) => `${s.name} ${s.n}`)
                        .join(', ')}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="drill">
          <div className="drill-head">
            <b>
              {selected.label} — {selected.closed} completed
            </b>
            <button type="button" className="tbtn" onClick={() => setPicked(null)}>
              Close
            </button>
          </div>
          <div className="drill-list">
            {selected.issues.map((issue) => (
              <a
                key={issue.key}
                className="drill-row"
                href={`${siteUrl}/browse/${encodeURIComponent(issue.key)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <i style={{ background: colorFor(issue.projectKey) }} />
                <span className="k">{issue.key}</span>
                <span className="s">{issue.summary}</span>
                <span className="a">{timeAgo(closedAt(issue)?.toISOString() ?? null)}</span>
              </a>
            ))}
            {selected.issues.length === 0 && (
              <div className="empty">Nothing closed on this {grainWord}.</div>
            )}
          </div>
        </div>
      )}

      {!loading && !selected && best && best.closed > 0 && (
        <div className="dfoot">
          Busiest {grainWord}: <b>{best.label}</b> with {best.closed} completed.
          Select any column for the task list.
        </div>
      )}
    </article>
  );
}
