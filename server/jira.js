/**
 * Jira access layer — environment-agnostic.
 *
 * No Express, no Node-server APIs: this module is imported by both the local
 * Express proxy (server/index.js) and the Netlify Function
 * (netlify/functions/api.mjs), so the two can never drift apart.
 */

export class JiraError extends Error {
  constructor(status, message, hint) {
    super(message);
    this.status = status;
    this.hint = hint;
  }
}

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

const PAGE_SIZE = 100;

export function readConfig(env = {}) {
  const missing = ['JIRA_HOST', 'JIRA_EMAIL', 'JIRA_API_TOKEN'].filter((k) => !env[k]);
  const host = String(env.JIRA_HOST || '')
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
  const cloudId = env.JIRA_CLOUD_ID || '';
  const scoped = Boolean(cloudId);

  return {
    missing,
    host,
    scoped,
    // Scoped tokens authenticate through the API gateway, classic ones
    // through the site itself. Mixing these up surfaces as a silent 401.
    base: scoped ? `https://api.atlassian.com/ex/jira/${cloudId}` : `https://${host}`,
    siteUrl: `https://${host}`,
    auth: 'Basic ' + btoa(`${env.JIRA_EMAIL}:${env.JIRA_API_TOKEN}`),
    projectKeys: String(env.JIRA_PROJECTS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    // Serverless platforms cap execution time, so callers can tighten these.
    maxPages: Number(env.JIRA_MAX_PAGES) || 12,
    changelogCap: Number(env.JIRA_CHANGELOG_CAP) || 600,
    perIssueCap: Number(env.JIRA_PER_ISSUE_CAP) || 120,
  };
}

async function call(cfg, pathname, init = {}) {
  let res;
  try {
    res = await fetch(`${cfg.base}${pathname}`, {
      ...init,
      headers: {
        Authorization: cfg.auth,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    });
  } catch {
    throw new JiraError(
      502,
      `Could not reach ${cfg.base}`,
      'Check JIRA_HOST, the network, and any proxy or firewall between this server and Atlassian.',
    );
  }

  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = text;
  }

  if (!res.ok) {
    const detail =
      (body && (body.errorMessages?.join(' ') || body.message)) ||
      (typeof body === 'string' ? body.slice(0, 200) : '') ||
      `Jira responded ${res.status}`;
    throw new JiraError(res.status, detail, hintFor(res.status, cfg));
  }
  return body;
}

function hintFor(status, cfg) {
  if (status === 401) {
    return cfg.scoped
      ? 'Jira rejected the credentials. Check JIRA_EMAIL and JIRA_API_TOKEN, and confirm the token has the read:jira-work scope.'
      : 'Jira rejected the credentials. Check JIRA_EMAIL and JIRA_API_TOKEN. If the token was created "with scopes", you must also set JIRA_CLOUD_ID.';
  }
  if (status === 403) return 'Authenticated, but not permitted to read these issues.';
  if (status === 404) return `No Jira site at ${cfg.host}. Check JIRA_HOST.`;
  return undefined;
}

function buildJql(cfg, days) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const clauses = [`updated >= "${since}"`];
  if (cfg.projectKeys.length) {
    clauses.push(`project in (${cfg.projectKeys.map((k) => `"${k}"`).join(', ')})`);
  }
  return `${clauses.join(' AND ')} ORDER BY updated DESC`;
}

async function searchAll(cfg, jql) {
  const issues = [];
  let nextPageToken;
  let pages = 0;

  do {
    const body = await call(cfg, '/rest/api/3/search/jql', {
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
  } while (nextPageToken && pages < cfg.maxPages);

  return { issues, truncated: Boolean(nextPageToken) };
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Issue history.
 *
 * `expand: changelog` on /search/jql is NOT honoured — the enhanced search API
 * dropped expand options by design and silently returns issues with no history.
 * The supported route is /rest/api/3/changelog/bulkfetch, with a per-issue
 * fallback for sites where the bulk endpoint is unavailable.
 */
async function fetchChangelogs(cfg, issues) {
  const byId = new Map();
  const capped = issues.slice(0, cfg.changelogCap);
  const ids = capped.map((i) => i.id).filter(Boolean);
  if (!ids.length) return { byId, ok: true };

  try {
    for (const group of chunk(ids, 100)) {
      let nextPageToken;
      let guard = 0;
      do {
        const body = await call(cfg, '/rest/api/3/changelog/bulkfetch', {
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
  } catch {
    /* fall through to per-issue */
  }

  if (capped.length > cfg.perIssueCap) return { byId, ok: false };
  const queue = [...capped];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (queue.length) {
        const issue = queue.shift();
        if (!issue) return;
        try {
          const body = await call(
            cfg,
            `/rest/api/3/issue/${encodeURIComponent(issue.key)}/changelog?maxResults=100`,
          );
          byId.set(String(issue.id), body.values || []);
        } catch {
          /* one issue must not sink the refresh */
        }
      }
    }),
  );
  return { byId, ok: byId.size > 0 };
}

/** Status changes only — assignee, rank and field edits are not "work moved". */
function statusTransitions(histories) {
  const out = [];
  for (const h of histories || []) {
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

function slim(issue, histories) {
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
    resolved: f.resolutiondate || null,
    assignee: f.assignee?.displayName || null,
    priority: f.priority?.name || null,
    issueType: f.issuetype?.name || null,
    transitions: statusTransitions(histories),
  };
}

/**
 * The changelog records status *names* but not categories, so build a lookup
 * from the statuses present in this result set. That is how a custom status
 * like "For review" gets classified without hardcoding a workflow.
 */
function statusCategoryMap(issues) {
  const map = {};
  for (const issue of issues) {
    const st = issue.fields?.status;
    if (st?.name && st.statusCategory?.name) map[st.name] = st.statusCategory.name;
  }
  return map;
}

/* ------------------------------------------------------------- endpoints */

export async function getHealth(cfg) {
  if (cfg.missing.length) {
    throw new JiraError(500, `Missing environment variables: ${cfg.missing.join(', ')}`);
  }
  const me = await call(cfg, '/rest/api/3/myself');
  return {
    ok: true,
    site: cfg.host,
    siteUrl: cfg.siteUrl,
    tokenStyle: cfg.scoped ? 'scoped' : 'classic',
    account: { name: me.displayName, email: me.emailAddress },
    scopedProjects: cfg.projectKeys,
  };
}

export async function getIssues(cfg, daysRaw) {
  if (cfg.missing.length) {
    throw new JiraError(500, `Missing environment variables: ${cfg.missing.join(', ')}`);
  }
  const days = Math.min(Math.max(Number(daysRaw) || 30, 1), 365);
  const { issues, truncated } = await searchAll(cfg, buildJql(cfg, days));
  const { byId, ok: withChangelog } = await fetchChangelogs(cfg, issues);

  return {
    days,
    fetchedAt: new Date().toISOString(),
    truncated,
    withChangelog,
    statusCategories: statusCategoryMap(issues),
    count: issues.length,
    issues: issues.map((i) => slim(i, byId.get(String(i.id)))),
  };
}
