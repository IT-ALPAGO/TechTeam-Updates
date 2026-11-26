/**
 * Local development proxy.
 *
 * In production on Netlify the same logic runs as a serverless function
 * (netlify/functions/api.mjs); both import server/jira.js, so there is one
 * implementation and no drift. This file exists so `npm run dev` works
 * without the Netlify CLI.
 */

import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getHealth, getIssues, readConfig } from './jira.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { PORT = 8787, NODE_ENV } = process.env;

const cfg = readConfig(process.env);

if (cfg.missing.length) {
  console.error(
    `\n  Missing required environment variables: ${cfg.missing.join(', ')}\n` +
      `  Copy .env.example to .env and fill it in.\n`,
  );
}

/* Jira rate-limits; a minute of caching makes range-flipping free. */
const CACHE_MS = 60_000;
const cache = new Map();
function cached(key, producer) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return Promise.resolve(hit.value);
  return producer().then((value) => {
    cache.set(key, { at: Date.now(), value });
    return value;
  });
}

function fail(res, err) {
  const status = err.status || 500;
  console.error(`  request failed (${status}): ${err.message}`);
  res.status(status).json({ error: err.message, hint: err.hint });
}

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  try {
    res.json(await cached('health', () => getHealth(cfg)));
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ ok: false, error: err.message, hint: err.hint });
  }
});

app.get('/api/issues', async (req, res) => {
  try {
    res.json(await cached(`issues:${req.query.days}`, () => getIssues(cfg, req.query.days)));
  } catch (err) {
    fail(res, err);
  }
});

if (NODE_ENV === 'production') {
  const dist = path.join(__dirname, '..', 'dist');
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`  Jira proxy listening on http://localhost:${PORT}`);
  console.log(`  Site:     ${cfg.host || '(not configured)'}`);
  console.log(`  Token:    ${cfg.scoped ? 'scoped (via api.atlassian.com)' : 'classic'}`);
  console.log(
    `  Projects: ${cfg.projectKeys.length ? cfg.projectKeys.join(', ') : 'all visible projects'}`,
  );
});
