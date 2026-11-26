import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchHealth, fetchIssues, type Health } from '../lib/api';
import { buildMetrics } from '../lib/metrics';
import type { Measure, Metrics, Range } from '../types';

const REFRESH_MS = 5 * 60_000;

export interface JiraState {
  metrics: Metrics | null;
  health: Health | null;
  loading: boolean;
  error: { message: string; hint?: string } | null;
  fetchedAt: Date | null;
  truncated: boolean;
  refresh: () => void;
}

export function useJira(range: Range, measure: Measure): JiraState {
  const [raw, setRaw] = useState<{
    issues: Metrics['issues'];
    days: number;
    lookup: Record<string, string>;
  } | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<JiraState['error']>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [nonce, setNonce] = useState(0);

  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchHealth(ctrl.signal).then(setHealth).catch(() => {});
    return () => ctrl.abort();
  }, [nonce]);

  useEffect(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);

    fetchIssues(range.days, ctrl.signal)
      .then((res) => {
        setRaw({
          issues: res.issues,
          days: res.days,
          lookup: res.statusCategories || {},
        });
        setTruncated(res.truncated);
        setFetchedAt(new Date(res.fetchedAt));
      })
      .catch((err: Error & { hint?: string }) => {
        if (err.name === 'AbortError') return;
        setError({ message: err.message, hint: err.hint });
        setRaw(null);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });

    return () => ctrl.abort();
  }, [range.days, nonce]);

  // Quiet background refresh, paused while the tab is hidden.
  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) refresh();
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);

  // Re-derived when the measure changes; no refetch, the history is already here.
  const metrics = useMemo(
    () => (raw ? buildMetrics(raw.issues, raw.days, raw.lookup, measure) : null),
    [raw, measure],
  );

  return { metrics, health, loading, error, fetchedAt, truncated, refresh };
}
