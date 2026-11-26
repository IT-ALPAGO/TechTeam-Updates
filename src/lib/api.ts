import type { IssuesResponse } from '../types';

export interface ApiError {
  message: string;
  hint?: string;
}

async function parse(res: Response) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { error: text.slice(0, 300) };
  }
}

export async function fetchIssues(
  days: number,
  signal?: AbortSignal,
): Promise<IssuesResponse> {
  const res = await fetch(`/api/issues?days=${days}`, { signal });
  const body = await parse(res);

  if (!res.ok) {
    const err = new Error(body.error || `Request failed (${res.status})`) as Error & ApiError;
    err.hint = body.hint;
    throw err;
  }
  return body as IssuesResponse;
}

export interface Health {
  ok: boolean;
  site?: string;
  siteUrl?: string;
  tokenStyle?: 'classic' | 'scoped';
  account?: { name: string; email: string };
  scopedProjects?: string[];
  error?: string;
  hint?: string;
}

export async function fetchHealth(signal?: AbortSignal): Promise<Health> {
  try {
    const res = await fetch('/api/health', { signal });
    return (await parse(res)) as Health;
  } catch {
    return { ok: false, error: 'The API proxy is not reachable.' };
  }
}
