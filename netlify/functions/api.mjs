/**
 * Netlify Function serving /api/health and /api/issues.
 *
 * Same Jira logic as local development — both import server/jira.js.
 * Credentials come from Netlify environment variables, never from the bundle.
 */

import { getHealth, getIssues, readConfig } from '../../server/jira.js';

export default async (req) => {
  const url = new URL(req.url);
  // Netlify rewrites /api/* here; the tail is what we route on.
  const route = url.pathname.replace(/^.*\/(health|issues)$/, '$1');

  const cfg = readConfig({
    ...process.env,
    // Netlify's free tier caps a function at 10s, so keep one refresh inside it.
    JIRA_MAX_PAGES: process.env.JIRA_MAX_PAGES || '6',
    JIRA_CHANGELOG_CAP: process.env.JIRA_CHANGELOG_CAP || '300',
    JIRA_PER_ISSUE_CAP: process.env.JIRA_PER_ISSUE_CAP || '60',
  });

  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        'content-type': 'application/json',
        // The browser should always get fresh figures; the cost is one Jira call.
        'cache-control': 'no-store',
      },
    });

  try {
    if (route === 'health') return json(await getHealth(cfg));
    if (route === 'issues') return json(await getIssues(cfg, url.searchParams.get('days')));
    return json({ error: `Unknown API route: ${url.pathname}` }, 404);
  } catch (err) {
    const status = err.status || 500;
    const body = { error: err.message, hint: err.hint };
    return json(route === 'health' ? { ok: false, ...body } : body, status);
  }
};

export const config = { path: '/api/*' };
