import { Hono } from 'hono';
import type { Bindings, Variables } from '../types';
import { requireSession, verifyProjectOwnership } from '../middleware/auth';
import { serializeReportResult } from '../lib/report-evidence';

const reports = new Hono<{ Bindings: Bindings; Variables: Variables }>();
reports.use('*', requireSession);

// POST /:projectId/generate — generate a JSON report
reports.post('/:projectId/generate', async (c) => {
  const result = await verifyProjectOwnership(c, c.req.param('projectId'));
  if (!result) return c.json({ error: 'Forbidden' }, 403);

  const [config, checks, prompts] = await Promise.all([
    result.db.getBrandConfig(result.project.id),
    result.db.listChecks(result.project.id, 5),
    result.db.listPrompts(result.project.id),
  ]);

  let latestResults: any[] = [];
  if (checks.length > 0) {
    latestResults = await result.db.listResults(checks[0].id);
  }

  const mentionRate = checks.length > 0 ? checks[0].brand_mention_rate : null;

  return c.json({
    report: {
      generated_at: new Date().toISOString(),
      project: result.project,
      brand: config ? {
        name: config.brand_name,
        url: config.brand_url,
      } : null,
      summary: {
        mention_rate: mentionRate,
        total_checks: checks.length,
        total_prompts: prompts.length,
      },
      latest_check: checks.length > 0 ? {
        ...checks[0],
        results: latestResults.map(serializeReportResult),
      } : null,
      check_history: checks.map((ch: any) => ({
        id: ch.id,
        status: ch.status,
        brand_mention_rate: ch.brand_mention_rate,
        created_at: ch.created_at,
      })),
    },
  });
});

// GET /:projectId/reports — list generated reports (placeholder)
reports.get('/:projectId/reports', async (c) => {
  return c.json({ reports: [], message: 'Report history coming soon' });
});

export { reports };
