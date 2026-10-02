import { Hono } from 'hono';
import { trace } from '@saas-maker/ops';
import type { Bindings, Variables } from '../types';
import { requireSession, verifyProjectOwnership } from '../middleware/auth';
import { resolveMentionCheckSource, runMentionCheck } from '../lib/ai-engine';
import type { ResultRecord } from '@mentionpilot/shared';

const checks = new Hono<{ Bindings: Bindings; Variables: Variables }>();
checks.use('*', requireSession);

function toResultRecord(row: any): ResultRecord {
  return {
    ...row,
    brand_mentioned: !!row.brand_mentioned,
    brand_cited: !!row.brand_cited,
    competitors_mentioned: JSON.parse(row.competitors_mentioned || '[]'),
    citations: JSON.parse(row.citations || '[]'),
  };
}

// POST /:projectId — trigger a check
checks.post('/:projectId', async (c) => {
  const result = await verifyProjectOwnership(c, c.req.param('projectId'));
  if (!result) return c.json({ error: 'Forbidden' }, 403);

  const config = await result.db.getBrandConfig(result.project.id);
  if (!config) return c.json({ error: 'Configure brand first' }, 400);

  const source = resolveMentionCheckSource(config, c.env.FREE_AI);
  if (!source.source) {
    return c.json({ error: source.error }, 400);
  }

  const promptList = await result.db.listPrompts(result.project.id);
  if (promptList.length === 0) return c.json({ error: 'Add at least one prompt' }, 400);

  const checkId = crypto.randomUUID();
  const totalQueries = promptList.length; // one endpoint per prompt now

  const check = await result.db.createCheck({
    id: checkId,
    project_id: result.project.id,
    total_queries: totalQueries,
  });

  c.executionCtx.waitUntil(
    runMentionCheck(result.db, config, promptList, checkId, result.project.id, c.env.FREE_AI)
      .catch(() => console.error('Mention check did not finish successfully.'))
  );

  return c.json(check, 201);
});

// GET /:projectId — list past checks
checks.get('/:projectId', async (c) => {
  const result = await verifyProjectOwnership(c, c.req.param('projectId'));
  if (!result) return c.json({ error: 'Forbidden' }, 403);

  const list = await trace('db:listChecks', () => result.db.listChecks(result.project.id), { project: result.project.id });
  return c.json(list);
});

// GET /:projectId/dashboard — aggregate dashboard data
checks.get('/:projectId/dashboard', async (c) => {
  const result = await verifyProjectOwnership(c, c.req.param('projectId'));
  if (!result) return c.json({ error: 'Forbidden' }, 403);

  const [configRow, promptList, checkList] = await Promise.all([
    result.db.getBrandConfig(result.project.id),
    result.db.listPrompts(result.project.id),
    result.db.listChecks(result.project.id, 5),
  ]);

  let latestResults: ResultRecord[] = [];
  if (checkList.length > 0) {
    const rawResults = await result.db.listResults(checkList[0].id);
    latestResults = rawResults.map(toResultRecord);
  }

  const config = configRow ? {
    id: configRow.id,
    project_id: configRow.project_id,
    brand_name: configRow.brand_name,
    brand_aliases: JSON.parse(configRow.brand_aliases || '[]'),
    brand_url: configRow.brand_url,
    competitors: JSON.parse(configRow.competitors || '[]'),
    keywords: JSON.parse(configRow.keywords || '[]'),
    target_customer: configRow.target_customer || null,
    monitoring_topics: JSON.parse(configRow.monitoring_topics || '[]'),
    reddit_communities: JSON.parse(configRow.reddit_communities || '[]'),
    platforms: JSON.parse(configRow.platforms || '[]'),
    has_openai_key: !!configRow.openai_api_key,
    has_anthropic_key: !!configRow.anthropic_api_key,
    has_google_key: !!configRow.google_api_key,
    has_perplexity_key: !!configRow.perplexity_api_key,
    ai_endpoint_url: configRow.ai_endpoint_url || null,
    has_ai_api_key: !!configRow.ai_api_key,
    ai_model: configRow.ai_model || null,
    created_at: configRow.created_at,
    updated_at: configRow.updated_at,
  } : null;

  return c.json({
    config,
    prompts: promptList,
    recent_checks: checkList,
    latest_results: latestResults,
  });
});

// GET /:projectId/:checkId — get check with results
checks.get('/:projectId/:checkId', async (c) => {
  const result = await verifyProjectOwnership(c, c.req.param('projectId'));
  if (!result) return c.json({ error: 'Forbidden' }, 403);

  const check = await result.db.getCheckById(c.req.param('checkId'));
  if (!check || check.project_id !== result.project.id) return c.json({ error: 'Not found' }, 404);

  const results = await result.db.listResults(check.id);
  return c.json({ ...check, results: results.map(toResultRecord) });
});

export { checks };
