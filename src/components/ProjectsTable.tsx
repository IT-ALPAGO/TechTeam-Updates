import { BarsIcon } from './Icons';
import type { ProjectRow } from '../types';

interface Props {
  projects: ProjectRow[];
  loading: boolean;
  siteUrl: string;
}

export function ProjectsTable({ projects, loading, siteUrl }: Props) {
  // Every project with activity is listed; the body scrolls past ~8 rows
  // so the panel keeps its height alongside the progress donut.
  const rows = projects;

  return (
    <article className="card">
      <header className="chead">
        <div className="t">
          <BarsIcon />
          Projects Overview
        </div>
        <span className="clink">
          {loading ? '—' : `${projects.length} project${projects.length === 1 ? '' : 's'}`}
        </span>
      </header>

      <div className="thead">
        <div>Project</div>
        <div>Progress</div>
        <div />
        <div style={{ textAlign: 'center' }}>Tasks</div>
        <div>Status</div>
      </div>

      <div className="tbody">
        {loading && <div className="empty">Loading projects…</div>}
        {!loading && rows.length === 0 && (
          <div className="empty">No project activity in this period.</div>
        )}
        {rows.map((p) => (
          <a
            key={p.key}
            className="trow"
            href={`${siteUrl}/jira/software/projects/${encodeURIComponent(p.key)}/boards`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <div className="pcell">
              <div className="pico">{p.key.slice(0, 3)}</div>
              <div style={{ minWidth: 0 }}>
                <div className="pname">{p.name}</div>
                <div className="pdesc">
                  {p.key} • {p.progress} in progress, {p.todo} to do
                  {p.overdue > 0 ? ` • ${p.overdue} overdue` : ''}
                </div>
              </div>
            </div>

            <div className="barcell">
              <div className="bar">
                <i
                  style={{
                    width: `${p.pct}%`,
                    background: p.atRisk
                      ? 'linear-gradient(90deg,#4e86c9,#6aa8f5)'
                      : 'linear-gradient(90deg,#3f9b79,#5ad1a5)',
                  }}
                />
              </div>
            </div>

            <div className="pct">{p.pct}%</div>
            <div className="tasks">
              {p.done} / {p.total}
            </div>
            <div>
              <span className={`pill ${p.atRisk ? 'risk' : 'ok'}`}>
                <i />
                {p.atRisk ? 'At Risk' : 'On Track'}
              </span>
            </div>
          </a>
        ))}
      </div>
    </article>
  );
}
