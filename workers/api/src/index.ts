import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { configurePostHog, trace, flushPostHog } from '@saas-maker/ops';
import type { Bindings, Variables } from './types';
import { mentionPilotAppHealthMiddleware } from './app-health';
import { auth } from './routes/auth';
import { brands } from './routes/brands';
import { prompts } from './routes/prompts';
import { checks } from './routes/checks';
import { freeCheck } from './routes/free-check';
import { analytics } from './routes/analytics';
import { geo } from './routes/geo';
import { social } from './routes/social';
import { publicRoutes } from './routes/public';
import { apiKeys } from './routes/api-keys';
import { teams } from './routes/teams';
import { reports } from './routes/reports';
import { axp } from './routes/axp';
import { directories } from './routes/directories';
import { projects } from './routes/projects';
import { badge } from './routes/badge';
import { intelligence } from './routes/intelligence';
import { getDb } from './db';
import { resolveMentionCheckSource, runMentionCheck } from './lib/ai-engine';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// CORS allowlist for authenticated routes (dashboard calls from our own web).
const CORS_ALLOWED_ORIGINS = [
  'https://mention.highsignal.app',
  'https://mentionpilot-web.sarthakagrawal927.workers.dev',
  'https://mentionpilot-web.vercel.app',
  'https://mentionpilot.com',
  'https://www.mentionpilot.com',
];
const VERCEL_PREVIEW_RE = /^https:\/\/mentionpilot-web-[a-z0-9-]+\.vercel\.app$/;
const LOCALHOST_RE = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

// Public routes that need open CORS (embedded widgets, free tools, SEO pages).
const PUBLIC_CORS_PATHS = ['/v1/badge', '/v1/public', '/v1/free-check', '/v1/geo'];

// Permissive CORS for embed/public endpoints — callable from any origin.
app.use('*', async (c, next) => {
  const path = c.req.path;
  const isPublic = path === '/health' || PUBLIC_CORS_PATHS.some((p) => path.startsWith(p));
  if (isPublic) {
    return cors({ origin: '*', credentials: false })(c, next);
  }
  return cors({
    origin: (origin) => {
      if (!origin) return origin;
      if (CORS_ALLOWED_ORIGINS.includes(origin)) return origin;
      if (VERCEL_PREVIEW_RE.test(origin)) return origin;
      if (LOCALHOST_RE.test(origin)) return origin;
      return null;
    },
    credentials: true,
  })(c, next);
});

// Request ID middleware
app.use('*', async (c, next) => {
  c.set('requestId', crypto.randomUUID());
  await next();
});

// PostHog tracing middleware
let phConfigured = false;
app.use('*', async (c, next) => {
  if (!phConfigured && c.env.POSTHOG_API_KEY) {
    configurePostHog(c.env.POSTHOG_API_KEY, 'https://us.i.posthog.com');
    phConfigured = true;
  }
  await next();
  if (c.env.POSTHOG_API_KEY) c.executionCtx.waitUntil(flushPostHog());
});

// App Health endpoint monitoring — inert until APP_HEALTH_INGEST_KEY is set.
// Records only method, matched route template, status, duration, and declared
// response bytes; delivery runs in waitUntil and never blocks the response.
app.use('*', mentionPilotAppHealthMiddleware());

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount routes
app.route('/v1/auth', auth);
app.route('/v1/brands', brands);
app.route('/v1/prompts', prompts);
app.route('/v1/checks', checks);
app.route('/v1/free-check', freeCheck);
app.route('/v1/analytics', analytics);
app.route('/v1/geo', geo);
app.route('/v1/social', social);
app.route('/v1/public', publicRoutes);
app.route('/v1/api-keys', apiKeys);
app.route('/v1/teams', teams);
app.route('/v1/reports', reports);
app.route('/v1/axp', axp);
app.route('/v1/directories', directories);
app.route('/v1/projects', projects);
app.route('/v1/badge', badge);
app.route('/v1/intelligence', intelligence);

export default {
  fetch: app.fetch,

  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    const db = getDb(env.DB);

    const now = new Date(event.scheduledTime);

    // Process daily schedules
    const dailyProjects = await db.listScheduledProjects('daily');
    for (const project of dailyProjects) {
      const lastCheck = project.last_scheduled_check
        ? new Date(project.last_scheduled_check)
        : null;

      // Skip if checked within the last 23 hours (buffer for cron drift)
      if (lastCheck && now.getTime() - lastCheck.getTime() < 23 * 60 * 60 * 1000) {
        continue;
      }

      ctx.waitUntil(runScheduledCheck(db, project, env));
    }

    // Process weekly schedules (only on Mondays)
    if (now.getUTCDay() === 1) {
      const weeklyProjects = await db.listScheduledProjects('weekly');
      for (const project of weeklyProjects) {
        const lastCheck = project.last_scheduled_check
          ? new Date(project.last_scheduled_check)
          : null;

        // Skip if checked within the last 6 days
        if (lastCheck && now.getTime() - lastCheck.getTime() < 6 * 24 * 60 * 60 * 1000) {
          continue;
        }

        ctx.waitUntil(runScheduledCheck(db, project, env));
      }
    }
  },
};

async function runScheduledCheck(
  db: ReturnType<typeof getDb>,
  project: Record<string, any>,
  env: Bindings
) {
  try {
    const promptList = await db.listPrompts(project.id);
    if (promptList.length === 0) return;

    const source = resolveMentionCheckSource({
      brand_name: project.brand_name,
      ai_endpoint_url: project.ai_endpoint_url ?? null,
      ai_api_key: project.ai_api_key ?? null,
      ai_model: project.ai_model ?? null,
    }, env.FREE_AI);
    if (!source.source) return;

    const checkId = crypto.randomUUID();
    const totalQueries = promptList.length;

    await db.createCheck({
      id: checkId,
      project_id: project.id,
      total_queries: totalQueries,
    });

    // Build a config object matching what runMentionCheck expects
    const config = {
      ai_endpoint_url: project.ai_endpoint_url,
      ai_api_key: project.ai_api_key,
      ai_model: project.ai_model,
      brand_name: project.brand_name,
      brand_aliases: project.brand_aliases,
      brand_url: project.brand_url,
      competitors: project.competitors,
    };

    await runMentionCheck(db, config, promptList, checkId, project.id, env.FREE_AI);
    await db.updateProjectLastCheck(project.id);
  } catch (err) {
    console.error(`Scheduled check failed for project ${project.id}:`, err);
  }
}
