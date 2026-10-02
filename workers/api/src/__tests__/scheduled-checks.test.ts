import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../db';
import worker from '../index';
import type { Bindings } from '../types';

vi.mock('../db', () => ({ getDb: vi.fn() }));

const ready = {
  id: '11111111-1111-4111-8111-111111111111', brand_name: 'Example Product', brand_aliases: '[]',
  brand_url: 'https://example.test', competitors: '[]',
  ai_endpoint_url: 'https://synthetic-provider.test/completions',
  ai_api_key: 'synthetic-fixture-key', ai_model: 'synthetic-model', last_scheduled_check: null as string | null,
};
const managedProject = {
  ...ready, ai_endpoint_url: null, ai_api_key: null, ai_model: null,
};
let managedFetch: (request: Request) => Promise<Response>;
const env: Bindings = {
  DB: {} as D1Database, ENVIRONMENT: 'test',
  FREE_AI: { fetch: (request: Request) => managedFetch(request) } as unknown as Fetcher,
};
let db: ReturnType<typeof createDb>;
let providerFetch: ReturnType<typeof vi.fn>;
let activeScheduledTime: number;
let lastAttemptByProject = new Map<string, number>();

function createDb() {
  return {
    listScheduledProjects: vi.fn().mockImplementation(async (schedule: string) => schedule === 'daily'
      ? [{ ...ready, last_scheduled_check: lastAttemptByProject.has(ready.id) ? new Date(lastAttemptByProject.get(ready.id)!).toISOString() : null }]
      : []),
    listPrompts: vi.fn().mockResolvedValue([{ id: 'synthetic-prompt', prompt_text: 'Which product supports this use case?' }]),
    createCheck: vi.fn().mockImplementation(async (input) => input),
    createResult: vi.fn().mockImplementation(async (input) => input),
    updateCheck: vi.fn().mockResolvedValue(undefined),
    updateProjectLastCheck: vi.fn().mockImplementation(async (projectId: string) => {
      lastAttemptByProject.set(projectId, activeScheduledTime);
    }),
  };
}

async function tick(iso: string) {
  const pending: Promise<unknown>[] = [];
  const context = { waitUntil: (job: Promise<unknown>) => pending.push(job) } as unknown as ExecutionContext;
  const event = { scheduledTime: Date.parse(iso) } as ScheduledEvent;
  activeScheduledTime = event.scheduledTime;
  await worker.scheduled(event, env, context);
  return Promise.allSettled(pending);
}

beforeEach(() => {
  db = createDb();
  vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
  managedFetch = async () => Response.json({
    model: 'observed-managed-model',
    choices: [{ message: { content: 'Example Product appears here. https://example.test/docs' } }],
  });
  providerFetch = vi.fn().mockResolvedValue(Response.json({
    model: 'synthetic-model', choices: [{ message: { content: 'Example Product supports this use case. https://example.test/docs' } }],
  }));
  lastAttemptByProject = new Map();
  activeScheduledTime = Date.parse('2026-10-02T06:00:00Z');
  vi.stubGlobal('fetch', providerFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('scheduled mention checks with synthetic provider responses', () => {
  it('runs a due project through the real engine and retains identifiable evidence', async () => {
    const outcomes = await tick('2026-10-02T06:00:00Z');
    expect(db.listPrompts).toHaveBeenCalledWith(ready.id);
    expect(providerFetch).toHaveBeenCalledOnce();
    expect(providerFetch.mock.calls[0][0]).toBe(ready.ai_endpoint_url);
    const result = db.createResult.mock.calls[0][0];
    expect(result).toMatchObject({
      project_id: ready.id, prompt_id: 'synthetic-prompt',
      prompt_text: 'Which product supports this use case?', model: 'synthetic-model',
      provider_status: 'success', brand_mentioned: true,
      response_text: 'Example Product supports this use case. https://example.test/docs',
      citations: '["https://example.test/docs"]',
    });
    expect(result.check_id).toBe(db.createCheck.mock.calls[0][0].id);
    expect(db.updateCheck).toHaveBeenLastCalledWith(result.check_id, expect.objectContaining({ status: 'completed', brand_mention_rate: 1 }));
    expect(db.updateProjectLastCheck).toHaveBeenCalledWith(ready.id);
    expect(outcomes).toEqual([expect.objectContaining({ status: 'fulfilled' })]);
  });

  it('does not check weekly projects outside Monday UTC', async () => {
    db.listScheduledProjects.mockResolvedValue([]);
    await tick('2026-10-02T06:00:00Z');
    expect(db.listScheduledProjects).toHaveBeenCalledWith('daily');
    expect(db.listScheduledProjects).not.toHaveBeenCalledWith('weekly');
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it('runs a due weekly project on Monday UTC', async () => {
    db.listScheduledProjects.mockImplementation(async (schedule: string) => schedule === 'weekly' ? [ready] : []);
    await tick('2026-10-05T06:00:00Z');
    expect(db.listScheduledProjects).toHaveBeenCalledWith('weekly');
    expect(providerFetch).toHaveBeenCalledOnce();
    expect(db.updateProjectLastCheck).toHaveBeenCalledWith(ready.id);
  });

  it('runs due projects without custom endpoint through FREE_AI and stores full evidence', async () => {
    db.listScheduledProjects.mockImplementation(async (schedule: string) => schedule === 'daily' ? [managedProject] : []);
    const requests: Request[] = [];
    managedFetch = async (request) => {
      requests.push(request);
      return Response.json({
        model: 'observed-managed-model',
        choices: [{ message: { content: 'Example Product appears here. https://example.test/docs' } }],
      });
    };

    const outcomes = await tick('2026-10-02T06:00:00Z');

    expect(outcomes[0]).toMatchObject({ status: 'fulfilled', value: { status: 'completed', attemptedQueries: 1, successfulQueries: 1, failedQueries: 0 } });
    expect(providerFetch).not.toHaveBeenCalled();
    expect(requests).toHaveLength(1);
    const result = db.createResult.mock.calls[0][0];
    expect(result).toMatchObject({
      project_id: managedProject.id, prompt_id: 'synthetic-prompt',
      platform: 'free-ai', model: 'observed-managed-model', provider_status: 'success',
      response_text: 'Example Product appears here. https://example.test/docs',
      citations: '["https://example.test/docs"]', brand_cited: true,
    });
    expect(db.updateCheck).toHaveBeenLastCalledWith(result.check_id, expect.objectContaining({ status: 'completed', brand_mention_rate: 1 }));
    expect(db.updateProjectLastCheck).toHaveBeenCalledWith(managedProject.id);
  });

  it('stores managed gateway errors without inventing a model or successful mention rate', async () => {
    db.listScheduledProjects.mockImplementation(async (schedule: string) => schedule === 'daily' ? [managedProject] : []);
    managedFetch = async () => new Response('synthetic gateway unavailable', { status: 503 });

    const outcomes = await tick('2026-10-02T06:00:00Z');

    const result = db.createResult.mock.calls[0][0];
    expect(result).toMatchObject({
      platform: 'free-ai', model: 'unknown', provider_status: 'error',
      error_message: 'Provider returned an error (503)', response_text: '', citations: '[]',
    });
    expect(db.updateCheck).toHaveBeenLastCalledWith(result.check_id, expect.objectContaining({ status: 'failed', brand_mention_rate: null }));
    expect(outcomes[0].status).toBe('rejected');
    expect(db.updateProjectLastCheck).toHaveBeenCalledWith(managedProject.id);
  });

  it('skips a daily project checked within 23 hours', async () => {
    db.listScheduledProjects.mockResolvedValue([{ ...ready, last_scheduled_check: '2026-10-01T08:00:00Z' }]);
    await tick('2026-10-02T06:00:00Z');
    expect(providerFetch).not.toHaveBeenCalled();
    expect(db.createCheck).not.toHaveBeenCalled();
  });

  it('skips a weekly project checked within six days', async () => {
    db.listScheduledProjects.mockImplementation(async (schedule: string) => schedule === 'weekly' ? [{ ...ready, last_scheduled_check: '2026-10-01T06:00:00Z' }] : []);
    await tick('2026-10-05T06:00:00Z');
    expect(providerFetch).not.toHaveBeenCalled();
    expect(db.createCheck).not.toHaveBeenCalled();
  });

  it('does not create an empty check without prompts', async () => {
    db.listPrompts.mockResolvedValue([]);
    await tick('2026-10-02T06:00:00Z');
    expect(providerFetch).not.toHaveBeenCalled();
    expect(db.createCheck).not.toHaveBeenCalled();
    expect(db.updateProjectLastCheck).not.toHaveBeenCalled();
  });

  it('retains provider failure explicitly without assigning a zero mention rate', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    providerFetch.mockRejectedValue(new Error('Synthetic unavailable provider'));
    const outcomes = await tick('2026-10-02T06:00:00Z');
    expect(db.createResult).toHaveBeenCalledWith(expect.objectContaining({
      provider_status: 'error', error_message: 'Provider request failed', response_text: '',
    }));
    expect(db.updateCheck).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ status: 'failed', brand_mention_rate: null }));
    expect(outcomes[0].status).toBe('rejected');
    expect(log).toHaveBeenCalledWith('Scheduled check failed', {
      outcome: 'persisted-failed-outcome', projectId: ready.id,
      checkId: db.createCheck.mock.calls[0][0].id,
    });
    expect(db.updateProjectLastCheck).toHaveBeenCalledWith(ready.id);
    await tick('2026-10-03T04:59:00Z');
    expect(providerFetch).toHaveBeenCalledOnce();
  });

  it('records partial evidence and resolves the scheduled promise with available-response counts', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    db.listPrompts.mockResolvedValue([
      { id: 'prompt-a', prompt_text: 'First question?' },
      { id: 'prompt-b', prompt_text: 'Second question?' },
    ]);
    providerFetch.mockRejectedValueOnce(new Error('private response with https://secret.example/?token=hidden'));

    const outcomes = await tick('2026-10-02T06:00:00Z');

    expect(outcomes[0]).toMatchObject({ status: 'fulfilled', value: {
      status: 'partial', attemptedQueries: 2, successfulQueries: 1, failedQueries: 1,
    } });
    expect(warning).toHaveBeenCalledWith('Scheduled check completed partially', expect.objectContaining({
      attemptedQueries: 2, successfulQueries: 1, failedQueries: 1,
    }));
    expect(db.createResult).toHaveBeenCalledTimes(2);
    expect(db.createResult.mock.calls[0][0]).toMatchObject({
      prompt_id: 'prompt-a', provider_status: 'error', error_message: 'Provider request failed', response_text: '',
    });
    expect(db.createResult.mock.calls[1][0]).toMatchObject({ prompt_id: 'prompt-b', provider_status: 'success' });
    expect(db.updateCheck).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({
      status: 'completed', brand_mention_rate: 1,
    }));
    expect(db.updateCheck).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ completed_queries: 2 }));
  });

  it('keeps an independent successful project running when another project fails', async () => {
    const failing = { ...ready, id: 'failing-project', ai_endpoint_url: 'https://failing-provider.test/completions' };
    const succeeding = { ...ready, id: 'succeeding-project', ai_endpoint_url: 'https://working-provider.test/completions' };
    db.listScheduledProjects.mockImplementation(async (schedule: string) => schedule === 'daily' ? [failing, succeeding] : []);
    providerFetch.mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input).includes('failing-provider')) throw new Error('private provider response');
      return Response.json({ model: 'synthetic-model', choices: [{ message: { content: 'Example Product appears.' } }] });
    });

    const outcomes = await tick('2026-10-02T06:00:00Z');

    expect(outcomes.map(({ status }) => status)).toEqual(['rejected', 'fulfilled']);
    expect(providerFetch).toHaveBeenCalledTimes(2);
    expect(db.createResult.mock.calls.map(([result]) => [result.project_id, result.provider_status])).toEqual([
      ['failing-project', 'error'], ['succeeding-project', 'success'],
    ]);
    expect(db.updateProjectLastCheck).toHaveBeenCalledTimes(2);
  });

  it('does not advance the attempt cursor when result evidence cannot be persisted', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    db.createResult.mockRejectedValue(new Error('database url=https://private.test/?key=secret'));

    const outcomes = await tick('2026-10-02T06:00:00Z');

    expect(outcomes[0].status).toBe('rejected');
    expect(db.updateCheck).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      status: 'failed', summary: 'Check did not finish because evidence persistence failed.',
    }));
    expect(db.updateProjectLastCheck).not.toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain('private.test');
    expect(JSON.stringify(log.mock.calls)).not.toContain('secret');
  });

  it('does not advance the attempt cursor when the terminal check write fails', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    providerFetch.mockRejectedValue(new Error('private provider response'));
    db.updateCheck.mockRejectedValue(new Error('private D1 detail'));

    const outcomes = await tick('2026-10-02T06:00:00Z');

    expect(outcomes[0].status).toBe('rejected');
    expect(db.updateProjectLastCheck).not.toHaveBeenCalled();
    expect(log.mock.calls.flat().join(' ')).not.toContain('private D1 detail');
  });

  it('skips incomplete custom AI setup without creating a check or moving the cursor', async () => {
    db.listScheduledProjects.mockImplementation(async (schedule: string) => schedule === 'daily'
      ? [{ ...ready, ai_api_key: null }]
      : []);

    const outcomes = await tick('2026-10-02T06:00:00Z');

    expect(outcomes).toEqual([expect.objectContaining({ status: 'fulfilled', value: { status: 'skipped', reason: 'source-not-ready' } })]);
    expect(providerFetch).not.toHaveBeenCalled();
    expect(db.createCheck).not.toHaveBeenCalled();
    expect(db.updateProjectLastCheck).not.toHaveBeenCalled();
  });

  it('fails malformed saved configuration safely without making provider calls or moving the cursor', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    db.listScheduledProjects.mockImplementation(async (schedule: string) => schedule === 'daily'
      ? [{ ...ready, brand_aliases: '{' }]
      : []);

    const outcomes = await tick('2026-10-02T06:00:00Z');

    expect(outcomes[0].status).toBe('rejected');
    expect(providerFetch).not.toHaveBeenCalled();
    expect(db.updateCheck).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      status: 'failed', brand_mention_rate: null,
      summary: 'Check did not finish because saved configuration or response analysis could not be processed.',
    }));
    expect(db.updateProjectLastCheck).not.toHaveBeenCalled();
    expect(log.mock.calls.flat().join(' ')).not.toContain('{');
  });

  it('treats empty BYOK content as unavailable evidence', async () => {
    providerFetch.mockResolvedValue(Response.json({ model: 'synthetic-model', choices: [{ message: { content: '' } }] }));

    const outcomes = await tick('2026-10-02T06:00:00Z');

    expect(outcomes[0].status).toBe('rejected');
    expect(providerFetch).toHaveBeenCalledOnce();
    expect(db.createResult).toHaveBeenCalledWith(expect.objectContaining({
      provider_status: 'error', error_message: 'Provider request failed', response_text: '',
    }));
    expect(db.updateCheck).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ status: 'failed', brand_mention_rate: null }));
    expect(db.updateProjectLastCheck).toHaveBeenCalledWith(ready.id);
  });

  it.each(['byok', 'managed'] as const)('bounds a stalled %s response body and records one failed attempt', async (source) => {
    const project = source === 'managed' ? managedProject : ready;
    const managedRequests: Request[] = [];
    db.listScheduledProjects.mockImplementation(async (schedule: string) => schedule === 'daily' ? [project] : []);
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockImplementation((milliseconds: number) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException('fixture deadline elapsed', 'TimeoutError')), Math.min(milliseconds, 5));
      return controller.signal;
    });
    const stalledResponse = (signal: AbortSignal) => new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        signal.addEventListener('abort', () => controller.error(signal.reason), { once: true });
      },
    }));
    if (source === 'byok') {
      providerFetch.mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
        return stalledResponse(init?.signal as AbortSignal);
      });
    } else {
      managedFetch = async (request) => {
        managedRequests.push(request);
        return stalledResponse(request.signal);
      };
    }

    const outcomes = await tick('2026-10-02T06:00:00Z');

    expect(outcomes[0].status).toBe('rejected');
    if (source === 'byok') expect(providerFetch).toHaveBeenCalledOnce();
    else expect(managedRequests).toHaveLength(1);
    expect(timeout).toHaveBeenCalledWith(30_000);
    expect(db.createResult).toHaveBeenCalledWith(expect.objectContaining({
      provider_status: 'error', error_message: 'Provider request timed out', response_text: '',
    }));
    expect(db.updateCheck).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ status: 'failed' }));
    expect(db.updateProjectLastCheck).toHaveBeenCalledWith(project.id);
  });
});
