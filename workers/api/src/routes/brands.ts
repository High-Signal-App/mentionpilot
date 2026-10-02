import { Hono } from 'hono';
import type { Bindings, Variables } from '../types';
import { requireSession, verifyProjectOwnership } from '../middleware/auth';
import type { BrandConfigRecord, AIPlatform } from '@mentionpilot/shared';
import { resolveMentionCheckSource } from '../lib/ai-engine';

const brands = new Hono<{ Bindings: Bindings; Variables: Variables }>();
brands.use('*', requireSession);

const VALID_PLATFORMS: AIPlatform[] = ['openai', 'anthropic', 'google', 'perplexity'];
const MAX_COMPETITORS = 5;
const VALID_SCHEDULES = ['daily', 'weekly'];

function parseList(value: unknown, max: number) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))].slice(0, max);
}

function optionalText(value: unknown) {
  return typeof value === 'string' ? value.trim() || null : null;
}

function toConfigRecord(row: any): BrandConfigRecord {
  return {
    id: row.id,
    project_id: row.project_id,
    brand_name: row.brand_name,
    brand_aliases: JSON.parse(row.brand_aliases || '[]'),
    brand_url: row.brand_url,
    competitors: JSON.parse(row.competitors || '[]'),
    keywords: JSON.parse(row.keywords || '[]'),
    target_customer: row.target_customer || null,
    monitoring_topics: JSON.parse(row.monitoring_topics || '[]'),
    reddit_communities: JSON.parse(row.reddit_communities || '[]'),
    platforms: JSON.parse(row.platforms || '[]'),
    has_openai_key: !!row.openai_api_key,
    has_anthropic_key: !!row.anthropic_api_key,
    has_google_key: !!row.google_api_key,
    has_perplexity_key: !!row.perplexity_api_key,
    ai_endpoint_url: row.ai_endpoint_url || null,
    has_ai_api_key: !!row.ai_api_key,
    ai_model: row.ai_model || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// GET /:projectId/config
brands.get('/:projectId/config', async (c) => {
  const result = await verifyProjectOwnership(c, c.req.param('projectId'));
  if (!result) return c.json({ error: 'Forbidden' }, 403);

  const row = await result.db.getBrandConfig(result.project.id);
  return c.json(row ? toConfigRecord(row) : null);
});

// POST /:projectId/config
brands.post('/:projectId/config', async (c) => {
  const result = await verifyProjectOwnership(c, c.req.param('projectId'));
  if (!result) return c.json({ error: 'Forbidden' }, 403);

  const body = await c.req.json();
  if (typeof body.brand_name !== 'string' || !body.brand_name.trim()) {
    return c.json({ error: 'brand_name is required' }, 400);
  }

  const rawCompetitors: unknown[] = Array.isArray(body.competitors) ? body.competitors : [];
  if (rawCompetitors.length > MAX_COMPETITORS) {
    return c.json({ error: `Max ${MAX_COMPETITORS} competitors` }, 400);
  }
  if (rawCompetitors.some((competitor) => {
    if (!competitor || typeof competitor !== 'object') return true;
    const name = (competitor as Record<string, unknown>).name;
    return typeof name !== 'string' || !name.trim();
  })) {
    return c.json({ error: 'Each competitor must have a name' }, 400);
  }
  const competitors = rawCompetitors.map((competitor) => {
    const item = competitor as Record<string, unknown>;
    const url = optionalText(item.url);
    return { name: String(item.name).trim(), ...(url ? { url } : {}) };
  });

  const keywords = parseList(body.keywords, 20);
  const monitoringTopics = parseList(body.monitoring_topics, 10);
  const redditCommunities = parseList(body.reddit_communities, 5);
  if (redditCommunities.some((community) => !/^[A-Za-z0-9_]{2,32}$/.test(community))) {
    return c.json({ error: 'Reddit communities must be subreddit names without r/' }, 400);
  }

  const platforms = body.platforms === undefined
    ? ['openai', 'anthropic', 'google', 'perplexity']
    : body.platforms;
  if (!Array.isArray(platforms)) return c.json({ error: 'platforms must be a list' }, 400);
  if (!platforms.every((p: string) => VALID_PLATFORMS.includes(p as AIPlatform))) {
    return c.json({ error: 'Invalid platform' }, 400);
  }

  const row = await result.db.upsertBrandConfig({
    id: crypto.randomUUID(),
    project_id: result.project.id,
    brand_name: body.brand_name.trim(),
    brand_aliases: JSON.stringify(parseList(body.brand_aliases, 20)),
    brand_url: optionalText(body.brand_url),
    competitors: JSON.stringify(competitors),
    keywords: JSON.stringify(keywords),
    target_customer: optionalText(body.target_customer),
    monitoring_topics: JSON.stringify(monitoringTopics),
    reddit_communities: JSON.stringify(redditCommunities),
    platforms: JSON.stringify(platforms),
    openai_api_key: body.openai_api_key || null,
    anthropic_api_key: body.anthropic_api_key || null,
    google_api_key: body.google_api_key || null,
    perplexity_api_key: body.perplexity_api_key || null,
    ai_endpoint_url: optionalText(body.ai_endpoint_url),
    ai_api_key: optionalText(body.ai_api_key),
    ai_model: optionalText(body.ai_model),
  });

  return c.json(toConfigRecord(row));
});

// DELETE /:projectId/config
brands.delete('/:projectId/config', async (c) => {
  const result = await verifyProjectOwnership(c, c.req.param('projectId'));
  if (!result) return c.json({ error: 'Forbidden' }, 403);

  await result.db.deleteBrandConfig(result.project.id);
  return c.json({ ok: true });
});

// GET /:projectId/schedule — saved state and readiness, without credentials.
brands.get('/:projectId/schedule', async (c) => {
  const result = await verifyProjectOwnership(c, c.req.param('projectId'));
  if (!result) return c.json({ error: 'Forbidden' }, 403);

  const [config, promptList] = await Promise.all([
    result.db.getBrandConfig(result.project.id),
    result.db.listPrompts(result.project.id),
  ]);
  const source = resolveMentionCheckSource(config ?? {
    brand_name: '', ai_endpoint_url: null, ai_api_key: null, ai_model: null,
  }, c.env.FREE_AI);
  return c.json({
    schedule: result.project.check_schedule ?? null,
    last_scheduled_check: result.project.last_scheduled_check ?? null,
    source: source.source,
    endpoint_configured: source.source !== null,
    prompt_count: promptList.length,
    badge_enabled: !!config?.badge_enabled,
  });
});

// PATCH /:projectId/schedule — set or clear the check schedule
brands.patch('/:projectId/schedule', async (c) => {
  const result = await verifyProjectOwnership(c, c.req.param('projectId'));
  if (!result) return c.json({ error: 'Forbidden' }, 403);

  const body: unknown = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body) || !('schedule' in body)) {
    return c.json({ error: 'Specify "daily", "weekly", or null to turn checks off.' }, 400);
  }
  const schedule = (body as Record<string, unknown>).schedule;

  if (schedule !== null && (typeof schedule !== 'string' || !VALID_SCHEDULES.includes(schedule))) {
    return c.json({ error: 'Invalid schedule. Use "daily", "weekly", or null.' }, 400);
  }

  if (schedule !== null) {
    const config = await result.db.getBrandConfig(result.project.id);
    const source = resolveMentionCheckSource(config ?? {
      brand_name: '', ai_endpoint_url: null, ai_api_key: null, ai_model: null,
    }, c.env.FREE_AI);
    if (!source.source) {
      return c.json({ error: source.error }, 400);
    }
    const promptList = await result.db.listPrompts(result.project.id);
    if (!promptList.length) {
      return c.json({ error: 'Add at least one prompt before scheduling checks.' }, 400);
    }
  }

  await result.db.updateProjectSchedule(result.project.id, schedule);
  return c.json({ ok: true, schedule });
});

// PATCH /:projectId/badge — enable or disable public badge
brands.patch('/:projectId/badge', async (c) => {
  const result = await verifyProjectOwnership(c, c.req.param('projectId'));
  if (!result) return c.json({ error: 'Forbidden' }, 403);

  const body = await c.req.json();
  const enabled = !!body.enabled;

  await result.db.updateBadgeEnabled(result.project.id, enabled);
  return c.json({ ok: true, badge_enabled: enabled });
});

export { brands };
