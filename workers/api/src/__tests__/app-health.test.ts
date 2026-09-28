import type {
  AppHealthClient,
  AppHealthClientOptions,
  EventInput,
} from '@saas-maker/app-health';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import {
  createMentionPilotAppHealthClient,
  mentionPilotAppHealthMiddleware,
} from '../app-health';
import type { Bindings, Variables } from '../types';

function clientSpy() {
  const events: EventInput[] = [];
  const flush = vi.fn(async () => {});
  const client: AppHealthClient = {
    record: (event) => events.push(event),
    log: () => {},
    flush,
    close: async () => {},
    diagnostics: () => ({
      queued: 0,
      sentBatches: 0,
      sentEvents: 0,
      failedBatches: 0,
      retriedBatches: 0,
      droppedInvalid: 0,
      droppedOverflow: 0,
      droppedDelivery: 0,
      lastSendError: null,
    }),
  };
  return { client, events, flush };
}

function executionContext(waits: Promise<unknown>[]): ExecutionContext {
  return {
    waitUntil: (promise) => {
      waits.push(promise);
    },
    passThroughOnException: () => {},
    props: {},
  } as ExecutionContext;
}

const baseEnv: Bindings = {
  DB: {} as D1Database,
  AI: {} as Ai,
  ENVIRONMENT: 'production',
};

describe('MentionPilot App Health endpoint monitoring', () => {
  it('stays inert when the private ingest key is missing or blank', () => {
    expect(createMentionPilotAppHealthClient(baseEnv)).toBeNull();
    expect(
      createMentionPilotAppHealthClient({ ...baseEnv, APP_HEALTH_INGEST_KEY: '   ' }),
    ).toBeNull();
  });

  it('records only the matched Hono route template and declared response fields', async () => {
    const { client, events, flush } = clientSpy();
    const waits: Promise<unknown>[] = [];
    const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
    app.use('*', mentionPilotAppHealthMiddleware(() => client));
    app.get('/v1/brands/:id', (context) => context.json({ ok: true }, 201));

    const response = await app.request(
      'https://api.mentionpilot.test/v1/brands/acme-private?token=secret',
      {
        headers: {
          authorization: 'Bearer private',
          cookie: 'session=private',
        },
      },
      baseEnv,
      executionContext(waits),
    );

    expect(response.status).toBe(201);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      method: 'GET',
      route: '/v1/brands/:id',
      status_code: 201,
    });
    // No concrete path, param value, header, cookie, or query value leaks.
    expect(JSON.stringify(events)).not.toContain('acme-private');
    expect(JSON.stringify(events)).not.toContain('secret');
    expect(flush).toHaveBeenCalledOnce();
    expect(waits).toHaveLength(1);
  });

  it('records a 5xx error response with the canonical route template', async () => {
    const { client, events } = clientSpy();
    const waits: Promise<unknown>[] = [];
    const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
    app.use('*', mentionPilotAppHealthMiddleware(() => client));
    app.get('/v1/checks/:id', (context) =>
      context.json({ error: 'unavailable' }, 503),
    );

    const response = await app.request(
      'https://api.mentionpilot.test/v1/checks/boom',
      undefined,
      baseEnv,
      executionContext(waits),
    );

    expect(response.status).toBe(503);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      method: 'GET',
      route: '/v1/checks/:id',
      status_code: 503,
    });
    expect(JSON.stringify(events)).not.toContain('boom');
  });

  it('preserves the business response when background delivery fails', async () => {
    const { client, events } = clientSpy();
    client.flush = vi.fn(async () => {
      throw new Error('collector unavailable');
    });
    const waits: Promise<unknown>[] = [];
    const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
    app.use('*', mentionPilotAppHealthMiddleware(() => client));
    app.get('/health', (context) => context.json({ status: 'ok' }));

    const response = await app.request(
      'https://api.mentionpilot.test/health',
      undefined,
      baseEnv,
      executionContext(waits),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
    expect(events[0]).toMatchObject({ route: '/health', status_code: 200 });
    // The failed delivery is isolated to waitUntil; the request still succeeds.
    expect((await Promise.allSettled(waits))[0]?.status).toBe('rejected');
  });

  it('delivers an accepted batch through the published Worker client', async () => {
    const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const collector: NonNullable<AppHealthClientOptions['fetch']> = async (
      input,
      init,
    ) => {
      requests.push({ input, ...(init ? { init } : {}) });
      return new Response(null, { status: 202 });
    };
    const waits: Promise<unknown>[] = [];
    const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
    app.use(
      '*',
      mentionPilotAppHealthMiddleware((env) =>
        createMentionPilotAppHealthClient(env, collector),
      ),
    );
    app.get('/v1/brands/:id', (context) => context.json({ ok: true }));

    const response = await app.request(
      'https://api.mentionpilot.test/v1/brands/acme-private',
      undefined,
      {
        ...baseEnv,
        APP_HEALTH_INGEST_KEY: 'synthetic-test-key',
        APP_HEALTH_ENVIRONMENT: 'production',
      },
      executionContext(waits),
    );
    await Promise.all(waits);

    expect(response.status).toBe(200);
    expect(requests).toHaveLength(1);
    expect(String(requests[0]?.input)).toBe(
      'https://ingest.sassmaker.com/v1/ingest',
    );
    const batch = JSON.parse(String(requests[0]?.init?.body)) as {
      environment?: string;
      events: EventInput[];
    };
    expect(batch.environment).toBe('production');
    expect(batch.events).toEqual([
      expect.objectContaining({
        method: 'GET',
        route: '/v1/brands/:id',
        status_code: 200,
      }),
    ]);
    expect(JSON.stringify(batch)).not.toContain('acme-private');
    expect(JSON.stringify(batch)).not.toContain('synthetic-test-key');
  });
});
