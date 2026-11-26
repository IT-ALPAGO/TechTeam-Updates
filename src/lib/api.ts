import type { IssuesResponse } from '../types';

export interface ApiError {
  message: string;
  hint?: string;
}

/**
 * Parse an API response.
 *
 * When the API isn't deployed, a host like Netlify answers /api/* with its own
 * 404 *HTML* page. Pasting that markup into an error banner is useless noise,
 * so detect a non-JSON body and say what actually went wrong instead.
 */
async function parse(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const looksLikeHtml = /^\s*(<!doctype|<html)/i.test(text);
    if (looksLikeHtml) {
      return {
        error: 'The API did not respond — a web page came back instead of data.',
        hint:
          res.status === 404
            ? 'The /api routes are not deployed. On Netlify this means the serverless function is missing: check netlify.toml and that the build published netlify/functions.'
            : 'Check that the API server is running and that /api is routed to it.',
      };
    }
    return { error: text.slice(0, 200) };
  }
}

export async function fetchIssues(
  days: number,
  signal?: AbortSignal,
): Promise<IssuesResponse> {
  const res = await fetch(`/api/issues?days=${days}`, { signal });
  const body = await parse(res);

  if (!res.ok) {
    const err = new Error(
      (body.error as string) || `Request failed (${res.status})`,
    ) as Error & ApiError;
    err.hint = body.hint as string | undefined;
    throw err;
  }

  // A 200 that isn't our payload (a cached HTML shell, a proxy page) must not
  // render as a dashboard full of zeros.
  if (!Array.isArray((body as unknown as IssuesResponse).issues)) {
    const err = new Error(
      (body.error as string) || 'The API returned an unexpected response.',
    ) as Error & ApiError;
    err.hint = (body.hint as string | undefined) ?? 'Expected JSON issue data from /api/issues.';
    throw err;
  }

  return body as unknown as IssuesResponse;
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
    const body = (await parse(res)) as unknown as Health;
    return res.ok ? body : { ...body, ok: false };
  } catch {
    return { ok: false, error: 'The API proxy is not reachable.' };
  }
}
