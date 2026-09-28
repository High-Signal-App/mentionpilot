// Optional, privacy-bounded App Health endpoint monitoring for the
// MentionPilot API Worker.
//
// Uses the official @saas-maker/app-health Hono adapter. The client is
// request-scoped and constructed only when a private ingest key is present;
// when the key is absent or blank the middleware is a complete no-op and the
// business response is returned unchanged. Delivery runs in
// ExecutionContext.waitUntil so a slow or failing collector never delays or
// breaks a request.
//
// Privacy: the adapter records only the HTTP method, Hono's matched route
// template, response status, integer duration, declared response byte count,
// timestamp, and optional release. It never reads the concrete URL, header
// values, cookies, query values, route parameter values, bodies, identity,
// logs, stacks, or spans.

import {
  createAppHealthClient,
  type AppHealthClient,
  type AppHealthClientOptions,
} from '@saas-maker/app-health';
import { honoMiddleware } from '@saas-maker/app-health/hono';
import type { Bindings, Variables } from './types';

const APP_HEALTH_INGEST_ENDPOINT = 'https://ingest.sassmaker.com/v1/ingest';

export type AppHealthClientFactory = (
  env: Bindings,
  fetchOverride?: AppHealthClientOptions['fetch'],
) => AppHealthClient | null;

type AppHealthBindings = Pick<Bindings, 'APP_HEALTH_ENVIRONMENT' | 'APP_HEALTH_INGEST_KEY' | 'ENVIRONMENT'>;

/**
 * Create one bounded Worker client per request, or return null to keep the
 * adapter inert until a private ingest key is configured. The key is read from
 * a Wrangler secret and is never logged or echoed back.
 */
export function createMentionPilotAppHealthClient(
  env: AppHealthBindings,
  fetchOverride?: AppHealthClientOptions['fetch'],
): AppHealthClient | null {
  const key = env.APP_HEALTH_INGEST_KEY?.trim();
  if (!key) return null;
  const environment = env.APP_HEALTH_ENVIRONMENT?.trim() || env.ENVIRONMENT?.trim();

  return createAppHealthClient({
    key,
    endpoint: APP_HEALTH_INGEST_ENDPOINT,
    runtime: 'worker',
    disableTimer: true,
    maxQueueSize: 1,
    maxRetries: 1,
    requestTimeoutMs: 1_500,
    ...(environment ? { environment } : {}),
    ...(fetchOverride ? { fetch: fetchOverride } : {}),
  });
}

/**
 * Hono middleware that records one normalized endpoint summary per completed
 * request. Mount it ahead of the business routes so Hono's last matched route
 * is the concrete canonical template. Inert when no ingest key is configured.
 */
export function mentionPilotAppHealthMiddleware(
  makeClient: AppHealthClientFactory = createMentionPilotAppHealthClient,
) {
  return honoMiddleware<{ Bindings: Bindings; Variables: Variables }>({
    client: (context) => makeClient(context.env),
  });
}
