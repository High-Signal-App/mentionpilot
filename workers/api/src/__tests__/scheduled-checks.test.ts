import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../db';
import worker from '../index';
import type { Bindings } from '../types';

vi.mock('../db', () => ({ getDb: vi.fn() }));

const ready = {
  id: 'synthetic-project', brand_name: 'Example Product', brand_aliases: '[]',
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

function createDb() {
  return {
    listScheduledProjects: vi.fn().mockImplementation(async (schedule: string) => schedule === 'daily' ? [ready] : []),
    listPrompts: vi.fn().mockResolvedValue([{ id: 'synthetic-prompt', prompt_text: 'Which product supports this use case?' }]),
    createCheck: vi.fn().mockImplementation(async (input) => input),
    createResult: vi.fn().mockImplementation(async (input) => input),
    updateCheck: vi.fn().mockResolvedValue(undefined),
    updateProjectLastCheck: vi.fn().mockResolvedValue(undefined),
  };
}

async function tick(iso: string) {
  const pending: Promise<unknown>[] = [];
  const context = { waitUntil: (job: Promise<unknown>) => pending.push(job) } as unknown as ExecutionContext;
  const event = { scheduledTime: Date.parse(iso) } as ScheduledEvent;
  await worker.scheduled(event, env, context);
  await Promise.all(pending);
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
  vi.stubGlobal('fetch', providerFetch);
});

afterEach(() => vi.unstubAllGlobals());

describe('scheduled mention checks with synthetic provider responses', () => {
  it('runs a due project through the real engine and retains identifiable evidence', async () => {
    await tick('2026-10-02T06:00:00Z');
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

    await tick('2026-10-02T06:00:00Z');

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

    await tick('2026-10-02T06:00:00Z');

    const result = db.createResult.mock.calls[0][0];
    expect(result).toMatchObject({
      platform: 'free-ai', model: 'unknown', provider_status: 'error',
      error_message: 'Managed AI gateway error (503)', response_text: '', citations: '[]',
    });
    expect(db.updateCheck).toHaveBeenLastCalledWith(result.check_id, expect.objectContaining({ status: 'failed', brand_mention_rate: null }));
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
    providerFetch.mockRejectedValue(new Error('Synthetic unavailable provider'));
    await tick('2026-10-02T06:00:00Z');
    expect(db.createResult).toHaveBeenCalledWith(expect.objectContaining({
      provider_status: 'error', error_message: 'Synthetic unavailable provider', response_text: '',
    }));
    expect(db.updateCheck).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ status: 'failed', brand_mention_rate: null }));
  });
});
