import { Hono } from 'hono';
import type { Bindings, Variables } from '../types';
import { getDb } from '../db';
import { crawlSite, generatePrompts } from '../lib/site-crawler';
import { queryManagedGateway, analyzeResponse } from '../lib/ai-engine';
import {
  buildSiteIntelligencePrompt,
  calculateReliableMentionRate,
  parseSiteIntelligence,
} from '../lib/free-check-intelligence';

const freeCheck = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const RATE_LIMIT_PER_HOUR = 3;

// POST / — trigger a free brand check
freeCheck.post('/', async (c) => {
  const body = await c.req.json() as { domain: string };
  if (!body.domain?.trim()) return c.json({ error: 'domain is required' }, 400);

  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
  const db = getDb(c.env.DB);

  // Rate limit
  const recentCount = await db.countRecentFreeChecks(ip);
  if (recentCount >= RATE_LIMIT_PER_HOUR) {
    return c.json({ error: 'Rate limit exceeded. Try again in an hour.' }, 429);
  }

  // Crawl site
  let siteInfo;
  try {
    siteInfo = await crawlSite(body.domain);
  } catch (err) {
    return c.json({ error: `Could not fetch ${body.domain}: ${(err as Error).message}` }, 400);
  }

  let intelligence = parseSiteIntelligence('', siteInfo);
  try {
    const prompt = buildSiteIntelligencePrompt(siteInfo);
    const response = await queryManagedGateway(c.env.FREE_AI, prompt, {
        json: true,
        maxTokens: 800,
        projectId: 'mentionpilot',
      });
    intelligence = parseSiteIntelligence(response.responseText, siteInfo);
  } catch (error) {
    // Deterministic, unbranded prompts remain available when interpretation fails.
    console.warn(JSON.stringify({
      event: 'free_check_interpretation_failed',
      request_id: c.get('requestId'),
      message: error instanceof Error ? error.message.slice(0, 240) : 'Unknown error',
    }));
    intelligence = parseSiteIntelligence('', siteInfo);
  }

  siteInfo = {
    ...siteInfo,
    brand_name: intelligence.brandName,
    brand_aliases: intelligence.brandAliases,
    category: intelligence.category,
  };
  const prompts = intelligence.prompts.length === 5
    ? intelligence.prompts
    : generatePrompts(siteInfo);
  const checkId = crypto.randomUUID();

  await db.createFreeCheck({
    id: checkId,
    domain: body.domain,
    brand_name: siteInfo.brand_name,
    ip_address: ip,
  });

  // Keep the request open until inference is persisted. A detached waitUntil batch
  // can outlive the Worker background window and leave a check stuck as running.
  try {
    const settledResults = await Promise.all(prompts.map(async (promptText) => {
      try {
        const response = await queryManagedGateway(c.env.FREE_AI, promptText, { projectId: 'mentionpilot' });
        const analysis = analyzeResponse(
          response.responseText,
          siteInfo.brand_name,
          siteInfo.brand_aliases ?? [],
          body.domain,
          []
        );

        return {
          prompt: promptText,
          platform: 'free-ai',
          model: response.model,
          brand_mentioned: analysis.brand_mentioned,
          brand_sentiment: analysis.brand_sentiment,
          brand_position: analysis.brand_position,
          brand_cited: analysis.brand_cited,
          response_preview: response.responseText.slice(0, 500),
          latency_ms: response.latencyMs,
        };
      } catch (error) {
        console.warn(JSON.stringify({
          event: 'free_check_query_failed',
          check_id: checkId,
          request_id: c.get('requestId'),
          message: error instanceof Error ? error.message.slice(0, 240) : 'Unknown error',
        }));
        return null;
      }
    }));

    const results = settledResults.filter((result) => result !== null);
    const mentionRate = calculateReliableMentionRate(results, Math.min(3, prompts.length));
    const hasEnoughEvidence = mentionRate !== null;
    const status = hasEnoughEvidence ? 'completed' : 'failed';
    await db.updateFreeCheck(checkId, {
      status,
      mention_rate: mentionRate,
      results: JSON.stringify(results),
      completed_at: new Date().toISOString(),
    });

    return c.json({ id: checkId, brand_name: siteInfo.brand_name, prompts, status }, 201);
  } catch {
    await db.updateFreeCheck(checkId, {
      status: 'failed',
      completed_at: new Date().toISOString(),
    }).catch(() => {});

    return c.json({ error: 'Free check failed', id: checkId }, 502);
  }
});

// GET /:id — poll for results
freeCheck.get('/:id', async (c) => {
  const db = getDb(c.env.DB);
  const check = await db.getFreeCheck(c.req.param('id'));
  if (!check) return c.json({ error: 'Not found' }, 404);

  return c.json({
    ...check,
    results: JSON.parse(check.results || '[]'),
    error: check.status === 'failed'
      ? 'The AI provider did not return enough responses for a reliable score.'
      : undefined,
  });
});

export { freeCheck };
