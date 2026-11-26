/**
 * Jira API proxy.
 *
 * The browser cannot call the Jira Cloud REST API directly: Atlassian does not
 * send CORS headers for it, and an API token must never be shipped to a client.
 * This tiny Express server is the only process that holds the credentials.
 *
 *   GET /api/health   -> connection status + the authenticated account
 *   GET /api/issues   -> issues updated within ?days=N, already paginated
 *
 * Run with:  node --env-file=.env server/index.js
 */

import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const {
  JIRA_HOST,
  JIRA_EMAIL,
  JIRA_API_TOKEN,
  JIRA_CLOUD_ID = '',
  JIRA_PROJECTS = '',
  PORT = 8787,
  NODE_ENV,
} = process.env;

/* ------------------------------------------------------------------ config */

const missing = ['JIRA_HOST', 'JIRA_EMAIL', 'JIRA_API_TOKEN'].filter(
  (k) => !process.env[k],
);

if (missing.length) {
  console.error(
    `\n  Missing required environment variables: ${missing.join(', ')}\n` +
      `  Copy .env.example to .env and fill it in.\n`,
  );
}

const HOST = String(JIRA_HOST || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');

/**
 * Atlassian has two token styles, and they do NOT share a base URL:
 *
 *   classic token  ->  https://<your-site>.atlassian.net
 *   scoped token   ->  https://api.atlassian.com/ex/jira/<cloudId>
 *
 * Set JIRA_CLOUD_ID in .env if you created a token "with scopes"; leave it
 * blank for a classic one. Getting this wrong surfaces as a 401, which is
 * why the error handler below calls it out explicitly.
 */
const SCOPED = Boolean(JIRA_CLOUD_ID);
const BASE = SCOPED
  ? `https://api.atlassian.com/ex/jira/${JIRA_CLOUD_ID}`
  : `https://${HOST}`;

const AUTH =
  'Basic ' + Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');

/** Browser-facing link target is always the site, never the API gateway. */
const SITE_URL = `https://${HOST}`;

const PROJECT_KEYS = JIRA_PROJECTS.split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const FIELDS = [
  'summary',
  'status',
  'project',
  'duedate',
  'updated',
  'created',
  'resolutiondate',
  'assignee',
  'priority',
  'issuetype',
];

const MAX_PAGES = 12;      // hard ceiling: 12 * 100 = 1200 issues per refresh
const PAGE_SIZE = 100;
const CACHE_MS = 60_000;   // Jira rate limits; one minute of caching is plenty
const CHANGELOG_CAP = 600; // issues to pull history for in one refresh
const PER_ISSUE_CAP = 120; // only fall back to per-issue calls below this

/* ------------------------------------------------------------------- cache */

const cache = new Map(); // key -> { at: number, value: unknown }

function cached(key, ttl, producer) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return Promise.resolve(hit.value);
  return producer().then((value) => {
    cache.set(key, { at: Date.now(), value });
    return value;
  });
}

/* -------------------------------------------------------------- jira client */

class JiraError extends Error {
  constructor(status, body) {
    const detail =
      (body && (body.errorMessages?.join(' ') || body.message)) ||
      (typeof body === 'string' ? body.slice(0, 200) : '');
    super(detail || `Jira responded ${status}`);
    this.status = status;
  }
}

async function jira(pathname, init = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${pathname}`, {
      ...init,
      headers: {
        Authorization: AUTH,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    });
  } catch (cause) {
    // DNS failure, no route, TLS rejection, corporate proxy, offline…
    const err = new JiraError(502, `Could not reach ${BASE}`);
    err.hint =
      'Check JIRA_HOST, your network connection, and any proxy or firewall between this server and Atlassian.';
    err.cause = cause;
    throw err;
  }

  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = text;
  }

  if (!res.ok) throw new JiraError(res.status, body);
  return body;
}

/**
 * Build the JQL for a rolling window. `updated` is the right field for a
 * reporting dashboard: it captures everything that moved in the period,
 * including issues created long ago but worked on recently.
 */
function buildJql(days) {
  const since = new Date(Date.now() - days * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const clauses = [`updated >= "${since}"`];
  if (PROJECT_KEYS.length) {
    clauses.push(`project in (${PROJECT_KEYS.map((k) => `"${k}"`).join(', ')})`);
  }
  return `${clauses.join(' AND ')} ORDER BY updated DESC`;
}

/** Page through /search/jql until Jira says there is nothing left. */
async function searchAll(jql) {
  const issues = [];
  let nextPageToken;
  let pages = 0;

  do {
    const body = await jira('/rest/api/3/search/jql', {
      method: 'POST',
      body: JSON.stringify({
        jql,
        fields: FIELDS,
        maxResults: PAGE_SIZE,
        ...(nextPageToken ? { nextPageToken } : {}),
      }),
    });

    issues.push(...(body.issues || []));
    nextPageToken = body.isLast ? undefined : body.nextPageToken;
    pages += 1;
  } while (nextPageToken && pages < MAX_PAGES);

  return { issues, truncated: Boolean(nextPageToken) };
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Fetch issue history.
 *
 * `expand: changelog` on /search/jql is NOT honoured — the enhanced search API
 * dropped expand options by design, and silently returns issues with no
 * changelog rather than erroring. That silence is why status movement showed
 * as zero. The supported route is the dedicated changelog endpoint:
 * /rest/api/3/changelog/bulkfetch, with a per-issue fallback for sites where
 * the bulk endpoint is unavailable.
 *
 * Returns a Map of issueId -> changeHistories[].
 */
async function fetchChangelogs(issues) {
  const byId = new Map();
  const capped = issues.slice(0, CHANGELOG_CAP);
  const ids = capped.map((i) => i.id).filter(Boolean);
  if (!ids.length) return { byId, ok: true };

  // Preferred: one call per 100 issues.
  try {
    for (const group of chunk(ids, 100)) {
      let nextPageToken;
      let guard = 0;
      do {
        const body = await jira('/rest/api/3/changelog/bulkfetch', {
          method: 'POST',
          body: JSON.stringify({
            issueIdsOrKeys: group,
            maxResults: 1000,
            ...(nextPageToken ? { nextPageToken } : {}),
          }),
        });
        for (const entry of body.issueChangeLogs || []) {
          const key = String(entry.issueId);
          const list = byId.get(key) || [];
          list.push(...(entry.changeHistories || []));
          byId.set(key, list);
        }
        nextPageToken = body.nextPageToken;
        guard += 1;
      } while (nextPageToken && guard < 10);
    }
    return { byId, ok: true };
  } catch (err) {
    console.warn(`  changelog/bulkfetch unavailable (${err.message}); falling back`);
  }

  // Fallback: one call per issue, bounded, with a little concurrency.
  if (capped.length > PER_ISSUE_CAP) return { byId, ok: false };
  const queue = [...capped];
  const workers = Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const issue = queue.shift();
      if (!issue) return;
      try {
        const body = await jira(
          `/rest/api/3/issue/${encodeURIComponent(issue.key)}/changelog?maxResults=100`,
        );
        byId.set(String(issue.id), body.values || []);
      } catch {
        /* one issue failing must not sink the refresh */
      }
    }
  });
  await Promise.all(workers);
  return { byId, ok: byId.size > 0 };
}

/** Status changes only — assignee, rank and field edits are not "work moved". */
function statusTransitions(issue) {
  const out = [];
  for (const h of issue.changeHistories || []) {
    for (const item of h.items || []) {
      if (item.field !== 'status') continue;
      if (!item.fromString || !item.toString) continue;
      out.push({
        at: h.created,
        from: item.fromString,
        to: item.toString,
        by: h.author?.displayName || null,
      });
    }
  }
  return out;
}

/** Strip Jira's payload down to what the dashboard actually renders. */
function slim(issue) {
  const f = issue.fields || {};
  return {
    key: issue.key,
    summary: f.summary || '',
    status: f.status?.name || 'Unknown',
    category: f.status?.statusCategory?.name || 'To Do',
    projectKey: f.project?.key || '—',
    projectName: f.project?.name || f.project?.key || 'Unknown',
    dueDate: f.duedate || null,
    updated: f.updated || null,
    created: f.created || null,
    // When an issue was actually completed. Next-gen projects don't always set
    // a resolution, so the UI falls back to `updated` for Done issues.
    resolved: f.resolutiondate || null,
    assignee: f.assignee?.displayName || null,
    priority: f.priority?.name || null,
    issueType: f.issuetype?.name || null,
    transitions: statusTransitions(issue),
  };
}

/**
 * Jira's changelog records status *names* but not their categories, so build a
 * name -> category lookup from the statuses actually present in this result
 * set. That is how a custom status like "For review" or "CLARIFICATION" gets
 * classified without hardcoding this site's workflow.
 */
function statusCategoryMap(issues) {
  const map = {};
  for (const issue of issues) {
    const st = issue.fields?.status;
    if (st?.name && st.statusCategory?.name) map[st.name] = st.statusCategory.name;
  }
  return map;
}

/* --------------------------------------------------------------------- app */

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  if (missing.length) {
    return res.status(500).json({
      ok: false,
      error: `Missing environment variables: ${missing.join(', ')}`,
    });
  }
  try {
    const me = await cached('me', 5 * 60_000, () => jira('/rest/api/3/myself'));
    res.json({
      ok: true,
      site: HOST,
      siteUrl: SITE_URL,
      tokenStyle: SCOPED ? 'scoped' : 'classic',
      account: { name: me.displayName, email: me.emailAddress },
      scopedProjects: PROJECT_KEYS,
    });
  } catch (err) {
    res
      .status(err.status || 500)
      .json({ ok: false, error: err.message, hint: err.hint });
  }
});

app.get('/api/issues', async (req, res) => {
  if (missing.length) {
    return res.status(500).json({
      error: `Missing environment variables: ${missing.join(', ')}`,
    });
  }

  const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);

  try {
    const payload = await cached(`issues:${days}`, CACHE_MS, async () => {
      const { issues, truncated } = await searchAll(buildJql(days));

      const { byId, ok: withChangelog } = await fetchChangelogs(issues);
      for (const issue of issues) {
        issue.changeHistories = byId.get(String(issue.id)) || [];
      }

      return {
        days,
        fetchedAt: new Date().toISOString(),
        truncated,
        withChangelog,
        statusCategories: statusCategoryMap(issues),
        count: issues.length,
        issues: issues.map(slim),
      };
    });
    res.json(payload);
  } catch (err) {
    const status = err.status || 500;
    const hint =
      err.hint ||
      (status === 401
        ? SCOPED
          ? 'Jira rejected the credentials. Check JIRA_EMAIL and JIRA_API_TOKEN, and confirm the token has the read:jira-work scope.'
          : 'Jira rejected the credentials. Check JIRA_EMAIL and JIRA_API_TOKEN. If you created a token "with scopes", you must also set JIRA_CLOUD_ID in .env.'
        : status === 403
          ? 'The account is authenticated but not permitted to read these issues.'
          : status === 404
            ? `No Jira site at ${HOST}. Check JIRA_HOST in .env.`
            : undefined);
    console.error(`  /api/issues failed (${status}): ${err.message}`);
    res.status(status).json({ error: err.message, hint });
  }
});

/* Serve the built UI in production so one process runs the whole thing. */
if (NODE_ENV === 'production') {
  const dist = path.join(__dirname, '..', 'dist');
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`  Jira proxy listening on http://localhost:${PORT}`);
  console.log(`  Site:     ${HOST || '(not configured)'}`);
  console.log(`  Token:    ${SCOPED ? 'scoped (via api.atlassian.com)' : 'classic'}`);
  console.log(
    `  Projects: ${PROJECT_KEYS.length ? PROJECT_KEYS.join(', ') : 'all visible projects'}`,
  );
});
