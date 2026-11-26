import { useEffect, useMemo, useState } from 'react';
import { BarsIcon } from './Icons';
import { timeAgo } from '../lib/metrics';
import {
  MAX_SERIES,
  OTHER_COLOR,
  OTHER_KEY,
  colorFor,
  registerProjects,
} from '../lib/projectColors';
import type { DayBucket, Measure, Metrics } from '../types';

const MEASURES: { id: Measure; label: string; noun: string }[] = [
  { id: 'moved', label: 'All movement', noun: 'status changes' },
  { id: 'started', label: 'Started', noun: 'moved into progress' },
  { id: 'completed', label: 'Completed', noun: 'completed' },
];


interface Props {
  metrics: Metrics | null;
  loading: boolean;
  siteUrl: string;
  rangeLabel: string;
  measure: Measure;
  onMeasure: (m: Measure) => void;
}

export function DailyBreakdown({
  metrics,
  loading,
  siteUrl,
  rangeLabel,
  measure,
  onMeasure,
}: Props) {
  const [picked, setPicked] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);

  // Reset the drill-down when the window or the measure changes.
  useEffect(() => setPicked(null), [rangeLabel, measure]);

  const series = useMemo(() => {
    if (!metrics) return [];
    const top = metrics.closedByProject.slice(0, MAX_SERIES);
    // Register exactly the series that will be drawn, so each gets a hue and
    // grey is only ever "Other".
    registerProjects(top.map((p) => p.key));
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
  const active = MEASURES.find((m) => m.id === measure) ?? MEASURES[0];

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
          Work moved per {grainWord}
        </div>
        <div className="dhead-right">
          <div className="seg-ctl" role="group" aria-label="What to count">
            {MEASURES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={m.id === measure ? 'on' : undefined}
                aria-pressed={m.id === measure}
                onClick={() => onMeasure(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <span className="clink">
            {loading ? '—' : `${metrics?.totalClosed ?? 0} ${active.noun} · ${rangeLabel}`}
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

      {!loading && metrics && !metrics.hasHistory && (
        <div className="empty">
          Jira returned no issue history for this period, so status movement
          cannot be shown. The “Completed” measure still works.
        </div>
      )}

      {!loading && metrics && metrics.hasHistory && metrics.totalClosed === 0 && (
        <div className="empty">
          No {active.noun} in this period.
          {measure !== 'moved' && ' Try “All movement”.'}
        </div>
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
                <th>Count</th>
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
              {selected.label} — {selected.closed} {active.noun}
            </b>
            <button type="button" className="tbtn" onClick={() => setPicked(null)}>
              Close
            </button>
          </div>
          <div className="drill-list">
            {selected.moves.map((move, i) => (
              <a
                key={`${move.issueKey}-${move.at}-${i}`}
                className="drill-row"
                href={`${siteUrl}/browse/${encodeURIComponent(move.issueKey)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <i style={{ background: colorFor(move.projectKey) }} />
                <span className="k">{move.issueKey}</span>
                <span className="s">{move.summary}</span>
                <span className="move">
                  <em>{move.from}</em>
                  <b>→</b>
                  <em className={`to ${move.kind}`}>{move.to}</em>
                </span>
                <span className="a">{timeAgo(move.at)}</span>
              </a>
            ))}
            {selected.moves.length === 0 && (
              <div className="empty">Nothing moved on this {grainWord}.</div>
            )}
          </div>
        </div>
      )}

      {!loading && !selected && best && best.closed > 0 && (
        <div className="dfoot">
          Busiest {grainWord}: <b>{best.label}</b> with {best.closed}.{' '}
          {metrics && measure === 'moved' && (
            <>
              Of {metrics.moves.length} status changes: {metrics.kindTotals.started}{' '}
              started, {metrics.kindTotals.advanced} advanced,{' '}
              {metrics.kindTotals.completed} completed
              {metrics.kindTotals.reopened > 0
                ? `, ${metrics.kindTotals.reopened} reopened`
                : ''}
              .{' '}
            </>
          )}
          Select any column for the detail.
        </div>
      )}
    </article>
  );
}
