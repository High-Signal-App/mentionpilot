import { Hono } from 'hono';
import type { Bindings, Variables } from '../types';
import { requireSession, verifyProjectOwnership } from '../middleware/auth';

const analytics = new Hono<{ Bindings: Bindings; Variables: Variables }>();
analytics.use('*', requireSession);

// GET /:projectId/trends -- mention rate over time
analytics.get('/:projectId/trends', async (c) => {
  const result = await verifyProjectOwnership(c, c.req.param('projectId'));
  if (!result) return c.json({ error: 'Forbidden' }, 403);

  const days = parseInt(c.req.query('days') || '30');

  const { results: checks } = await c.env.DB.prepare(
    `SELECT id, status, brand_mention_rate, total_queries, completed_queries, created_at
     FROM checks WHERE project_id = ? AND status = 'completed'
     ORDER BY created_at DESC LIMIT ?`
  ).bind(result.project.id, days).all();

  return c.json({ checks });
});

// GET /:projectId/share-of-voice -- brand vs competitors
analytics.get('/:projectId/share-of-voice', async (c) => {
  const result = await verifyProjectOwnership(c, c.req.param('projectId'));
  if (!result) return c.json({ error: 'Forbidden' }, 403);

  const latestCheck = await c.env.DB.prepare(
    `SELECT id FROM checks WHERE project_id = ? AND status = 'completed' ORDER BY created_at DESC LIMIT 1`
  ).bind(result.project.id).first();

  if (!latestCheck) return c.json({ brand: 0, competitors: {}, total: 0 });

  const { results: checkResults } = await c.env.DB.prepare(
    `SELECT brand_mentioned, competitors_mentioned FROM results WHERE check_id = ? AND provider_status = 'success'`
  ).bind(latestCheck.id as string).all();

  const total = checkResults.length;
  if (total === 0) return c.json({ brand: 0, competitors: {}, total: 0 });

  const brandMentions = checkResults.filter(r => r.brand_mentioned).length;
  const brandRate = brandMentions / total;

  // Aggregate competitor mentions
  const competitorCounts: Record<string, number> = {};
  for (const r of checkResults) {
    const competitors = JSON.parse((r.competitors_mentioned as string) || '[]');
    for (const comp of competitors) {
      if (comp.mentioned) {
        competitorCounts[comp.name] = (competitorCounts[comp.name] || 0) + 1;
      }
    }
  }

  const competitorRates: Record<string, number> = {};
  for (const [name, count] of Object.entries(competitorCounts)) {
    competitorRates[name] = count / total;
  }

  return c.json({ brand: brandRate, competitors: competitorRates, total });
});

// GET /:projectId/platform-breakdown -- mentions per platform
analytics.get('/:projectId/platform-breakdown', async (c) => {
  const result = await verifyProjectOwnership(c, c.req.param('projectId'));
  if (!result) return c.json({ error: 'Forbidden' }, 403);

  const latestCheck = await c.env.DB.prepare(
    `SELECT id FROM checks WHERE project_id = ? AND status = 'completed' ORDER BY created_at DESC LIMIT 1`
  ).bind(result.project.id).first();

  if (!latestCheck) return c.json({ platforms: {} });

  const { results: checkResults } = await c.env.DB.prepare(
    `SELECT platform, brand_mentioned FROM results WHERE check_id = ? AND provider_status = 'success'`
  ).bind(latestCheck.id as string).all();

  const platformStats: Record<string, { total: number; mentioned: number }> = {};
  for (const r of checkResults) {
    const p = r.platform as string;
    if (!platformStats[p]) platformStats[p] = { total: 0, mentioned: 0 };
    platformStats[p].total++;
    if (r.brand_mentioned) platformStats[p].mentioned++;
  }

  const platforms: Record<string, number> = {};
  for (const [name, stats] of Object.entries(platformStats)) {
    platforms[name] = stats.total > 0 ? stats.mentioned / stats.total : 0;
  }

  return c.json({ platforms });
});

// GET /:projectId/sentiment-breakdown -- sentiment distribution
analytics.get('/:projectId/sentiment-breakdown', async (c) => {
  const result = await verifyProjectOwnership(c, c.req.param('projectId'));
  if (!result) return c.json({ error: 'Forbidden' }, 403);

  const latestCheck = await c.env.DB.prepare(
    `SELECT id FROM checks WHERE project_id = ? AND status = 'completed' ORDER BY created_at DESC LIMIT 1`
  ).bind(result.project.id).first();

  if (!latestCheck) return c.json({ positive: 0, neutral: 0, negative: 0 });

  const { results: checkResults } = await c.env.DB.prepare(
    `SELECT brand_sentiment FROM results WHERE check_id = ? AND provider_status = 'success' AND brand_mentioned = 1`
  ).bind(latestCheck.id as string).all();

  const counts = { positive: 0, neutral: 0, negative: 0 };
  for (const r of checkResults) {
    const s = r.brand_sentiment as string;
    if (s === 'positive') counts.positive++;
    else if (s === 'negative') counts.negative++;
    else counts.neutral++;
  }

  return c.json(counts);
});

// GET /:projectId/citations -- most cited domains
analytics.get('/:projectId/citations', async (c) => {
  const result = await verifyProjectOwnership(c, c.req.param('projectId'));
  if (!result) return c.json({ error: 'Forbidden' }, 403);

  const latestCheck = await c.env.DB.prepare(
    `SELECT id FROM checks WHERE project_id = ? AND status = 'completed' ORDER BY created_at DESC LIMIT 1`
  ).bind(result.project.id).first();

  if (!latestCheck) return c.json({ citations: [] });

  const { results: checkResults } = await c.env.DB.prepare(
    `SELECT citations FROM results WHERE check_id = ? AND provider_status = 'success'`
  ).bind(latestCheck.id as string).all();

  const domainCounts: Record<string, number> = {};
  for (const r of checkResults) {
    const urls: string[] = JSON.parse((r.citations as string) || '[]');
    for (const url of urls) {
      try {
        const domain = new URL(url).hostname;
        domainCounts[domain] = (domainCounts[domain] || 0) + 1;
      } catch { /* skip invalid URLs */ }
    }
  }

  const citations = Object.entries(domainCounts)
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  return c.json({ citations });
});

// --- P6.1: Citation Source Analysis ---
analytics.get('/:projectId/citation-analysis', async (c) => {
  const result = await verifyProjectOwnership(c, c.req.param('projectId'));
  if (!result) return c.json({ error: 'Forbidden' }, 403);

  // Get last 5 completed checks
  const checks = await c.env.DB.prepare(
    `SELECT id, created_at FROM checks WHERE project_id = ? AND status = 'completed' ORDER BY created_at DESC LIMIT 5`
  ).bind(result.project.id).all();

  if (checks.results.length === 0) return c.json({ domains: [], brand_citation_trend: [], total_citations: 0 });

  const config = await result.db.getBrandConfig(result.project.id);
  const brandUrl = config?.brand_url || '';
  const brandDomain = brandUrl ? new URL(brandUrl.startsWith('http') ? brandUrl : `https://${brandUrl}`).hostname : '';

  const allDomainCounts: Record<string, number> = {};
  const brandCitationTrend: { check_date: string; cited: boolean; total_citations: number }[] = [];

  for (const check of checks.results) {
    const { results: checkResults } = await c.env.DB.prepare(
      `SELECT citations FROM results WHERE check_id = ? AND provider_status = 'success'`
    ).bind(check.id as string).all();

    let brandCited = false;
    let checkCitations = 0;

    for (const r of checkResults) {
      const urls: string[] = JSON.parse((r.citations as string) || '[]');
      for (const url of urls) {
        try {
          const domain = new URL(url).hostname;
          allDomainCounts[domain] = (allDomainCounts[domain] || 0) + 1;
          checkCitations++;
          if (brandDomain && domain.includes(brandDomain)) brandCited = true;
        } catch { /* skip */ }
      }
    }

    brandCitationTrend.push({
      check_date: check.created_at as string,
      cited: brandCited,
      total_citations: checkCitations,
    });
  }

  const domains = Object.entries(allDomainCounts)
    .map(([domain, count]) => ({
      domain,
      count,
      is_brand: brandDomain ? domain.includes(brandDomain) : false,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);

  return c.json({
    domains,
    brand_citation_trend: brandCitationTrend.reverse(),
    total_citations: Object.values(allDomainCounts).reduce((a, b) => a + b, 0),
    brand_domain: brandDomain || null,
  });
});

// --- P6.2: Prompt Discovery ---
analytics.get('/:projectId/discover-prompts', async (c) => {
  const result = await verifyProjectOwnership(c, c.req.param('projectId'));
  if (!result) return c.json({ error: 'Forbidden' }, 403);

  const config = await result.db.getBrandConfig(result.project.id);
  if (!config) return c.json({ error: 'Configure brand first' }, 400);

  const { discoverPrompts } = await import('../lib/prompt-discovery');
  const competitors = JSON.parse(config.competitors || '[]');
  const suggestions = await discoverPrompts(config.brand_name, config.brand_url, competitors);

  return c.json({ suggestions });
});

// --- P6.3: AI Visibility Score ---
analytics.get('/:projectId/visibility-score', async (c) => {
  const result = await verifyProjectOwnership(c, c.req.param('projectId'));
  if (!result) return c.json({ error: 'Forbidden' }, 403);

  // Get latest completed check
  const latestCheck = await c.env.DB.prepare(
    `SELECT id, brand_mention_rate FROM checks WHERE project_id = ? AND status = 'completed' ORDER BY created_at DESC LIMIT 1`
  ).bind(result.project.id).first();

  if (!latestCheck) return c.json({
    checkId: null,
    score: 0,
    breakdown: { mention: 0, sentiment: 0, position: 0, citation: 0, reach: 0 },
    max: { mention: 30, sentiment: 20, position: 20, citation: 15, reach: 15 },
    grade: 'N/A',
  });

  const { results: checkResults } = await c.env.DB.prepare(
    `SELECT brand_mentioned, brand_sentiment, brand_position, brand_cited, platform FROM results WHERE check_id = ? AND provider_status = 'success'`
  ).bind(latestCheck.id as string).all();

  const total = checkResults.length;
  if (total === 0) return c.json({
    checkId: latestCheck.id,
    score: 0,
    breakdown: { mention: 0, sentiment: 0, position: 0, citation: 0, reach: 0 },
    max: { mention: 30, sentiment: 20, position: 20, citation: 15, reach: 15 },
    grade: 'N/A',
  });

  // Mention score (0-30): what % of queries mention you
  const mentionRate = (latestCheck.brand_mention_rate as number) || 0;
  const mentionScore = Math.round(mentionRate * 30);

  // Sentiment score (0-20): positive sentiment ratio among mentions
  const mentionedResults = checkResults.filter(r => r.brand_mentioned);
  const positiveCount = mentionedResults.filter(r => r.brand_sentiment === 'positive').length;
  const sentimentScore = mentionedResults.length > 0 ? Math.round((positiveCount / mentionedResults.length) * 20) : 0;

  // Position score (0-20): average position (lower is better)
  const positionedResults = mentionedResults.filter(r => r.brand_position && (r.brand_position as number) > 0);
  let positionScore = 0;
  if (positionedResults.length > 0) {
    const avgPosition = positionedResults.reduce((sum, r) => sum + (r.brand_position as number), 0) / positionedResults.length;
    // Position 1 = 20 points, position 5+ = ~4 points
    positionScore = Math.round(Math.max(0, 20 - (avgPosition - 1) * 4));
  }

  // Citation score (0-15): how often your URL is cited
  const citedCount = checkResults.filter(r => r.brand_cited).length;
  const citationScore = Math.round((citedCount / total) * 15);

  // Reach score (0-15): how many platforms mention you
  const platformsMentioned = new Set(mentionedResults.map(r => r.platform as string));
  const totalPlatforms = new Set(checkResults.map(r => r.platform as string));
  const reachScore = totalPlatforms.size > 0 ? Math.round((platformsMentioned.size / totalPlatforms.size) * 15) : 0;

  const score = mentionScore + sentimentScore + positionScore + citationScore + reachScore;

  // Grade
  let grade = 'F';
  if (score >= 80) grade = 'A';
  else if (score >= 65) grade = 'B';
  else if (score >= 50) grade = 'C';
  else if (score >= 35) grade = 'D';

  return c.json({
    checkId: latestCheck.id,
    score,
    grade,
    breakdown: {
      mention: mentionScore,
      sentiment: sentimentScore,
      position: positionScore,
      citation: citationScore,
      reach: reachScore,
    },
    max: {
      mention: 30,
      sentiment: 20,
      position: 20,
      citation: 15,
      reach: 15,
    },
  });
});

export { analytics };
