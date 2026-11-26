import { useMemo, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { Hero, HeroBackdrop } from './components/Hero';
import { KpiCards } from './components/KpiCards';
import { DailyBreakdown } from './components/DailyBreakdown';
import { ProjectsTable } from './components/ProjectsTable';
import { OverallProgress } from './components/OverallProgress';
import { KeyInsights } from './components/KeyInsights';
import { NeedsAttention } from './components/NeedsAttention';
import { RecentActivity } from './components/RecentActivity';
import { WarnTriangleIcon } from './components/Icons';
import { useJira } from './hooks/useJira';
import type { Measure, Range } from './types';

const RANGES: Range[] = [
  { id: '7', label: 'Last 7 Days', days: 7 },
  { id: '30', label: 'Last 30 Days', days: 30 },
  { id: '90', label: 'Last 90 Days', days: 90 },
  { id: '180', label: 'Last 6 Months', days: 180 },
  { id: '365', label: 'Last 12 Months', days: 365 },
];

export default function App() {
  const [range, setRange] = useState<Range>(RANGES[1]);
  const [measure, setMeasure] = useState<Measure>('moved');
  const { metrics, health, loading, error, fetchedAt, truncated, refresh } = useJira(
    range,
    measure,
  );

  const siteUrl = useMemo(
    () => health?.siteUrl ?? (health?.site ? `https://${health.site}` : ''),
    [health?.siteUrl, health?.site],
  );

  const showSkeleton = loading && !metrics;

  return (
    <>
      <Sidebar health={health} onRefresh={refresh} loading={loading} />

      <main className="main">
        <HeroBackdrop />

        <TopBar
          ranges={RANGES}
          range={range}
          onRange={setRange}
          connected={!error && Boolean(metrics) && health?.ok === true}
          loading={loading}
          fetchedAt={fetchedAt}
        />

        <Hero />

        {error && (
          <div className="banner show" role="alert">
            <WarnTriangleIcon />
            <span>
              <b>Live data unavailable.</b> {error.message}
              {error.hint ? ` ${error.hint}` : ''}
            </span>
          </div>
        )}

        {!error && health && health.ok === false && (
          <div className="banner show" role="alert">
            <WarnTriangleIcon />
            <span>
              <b>Jira did not confirm your account.</b> {health.error}
              {health.hint ? ` ${health.hint}` : ''} Searches may return empty
              results rather than an error until this is resolved.
            </span>
          </div>
        )}

        {!error && truncated && (
          <div className="banner show">
            <WarnTriangleIcon />
            <span>
              <b>Large result set.</b> This period returned more issues than one refresh
              fetches — figures cover the most recently updated 1,200 items. Narrow the
              range, or scope <code>JIRA_PROJECTS</code> in <code>.env</code>.
            </span>
          </div>
        )}

        <KpiCards metrics={metrics} loading={showSkeleton} />

        <DailyBreakdown
          metrics={metrics}
          loading={showSkeleton}
          siteUrl={siteUrl}
          rangeLabel={range.label}
          measure={measure}
          onMeasure={setMeasure}
        />

        <section className="grid2">
          <ProjectsTable
            projects={metrics?.projects ?? []}
            loading={showSkeleton}
            siteUrl={siteUrl}
          />
          <OverallProgress metrics={metrics} />
        </section>

        <section className="grid3">
          <KeyInsights metrics={metrics} rangeLabel={range.label} days={range.days} />
          <NeedsAttention metrics={metrics} loading={showSkeleton} siteUrl={siteUrl} />
          <RecentActivity
            issues={metrics?.issues ?? []}
            loading={showSkeleton}
            siteUrl={siteUrl}
          />
        </section>
      </main>
    </>
  );
}
