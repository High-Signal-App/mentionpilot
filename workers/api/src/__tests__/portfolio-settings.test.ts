import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../db';
import { projects } from '../routes/projects';
import { brands } from '../routes/brands';
import { checks } from '../routes/checks';
import type { Bindings, Variables } from '../types';

vi.mock('../db', () => ({ getDb: vi.fn() }));

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
app.route('/v1/projects', projects);
app.route('/v1/brands', brands);
app.route('/v1/checks', checks);
const headers = { Authorization: 'Bearer synthetic-session', 'Content-Type': 'application/json' };
let project: { id: string; user_id: string; check_schedule: string | null; last_scheduled_check: string | null };
let db: ReturnType<typeof createDb>;
let brandConfig: Record<string, unknown> | null;
let managedResponse: (request: Request) => Promise<Response>;
let managedRequests: Request[];
const freeAI = { fetch: (request: Request) => managedResponse(request) } as unknown as Fetcher;
const env: Bindings = { DB: {} as D1Database, ENVIRONMENT: 'test', FREE_AI: freeAI };
const executionContext = { waitUntil: (promise: Promise<unknown>) => pending.push(promise) } as unknown as ExecutionContext;
let pending: Promise<unknown>[];

function createDb() {
  return {
    getSessionByTokenHash: vi.fn().mockResolvedValue({ user_id: 'owner-a' }),
    getApiKeyByHash: vi.fn().mockResolvedValue({ user_id: 'owner-a', scopes: '["read"]' }),
    getProjectById: vi.fn().mockImplementation(async () => project),
    createProject: vi.fn().mockImplementation(async (input) => ({ ...input, check_schedule: null })),
    listProjectsByUser: vi.fn().mockResolvedValue([{ id: 'existing', name: 'Existing brand' }]),
    getBrandConfig: vi.fn().mockImplementation(async () => brandConfig),
    listPrompts: vi.fn().mockResolvedValue([{ id: 'prompt-a', prompt_text: 'Which product supports this use case?' }]),
    updateProjectSchedule: vi.fn().mockImplementation(async (_id, schedule) => { project.check_schedule = schedule; }),
    createCheck: vi.fn().mockImplementation(async (input) => ({ ...input, status: 'running' })),
    createResult: vi.fn().mockImplementation(async (input) => input),
    updateCheck: vi.fn().mockResolvedValue(undefined),
  };
}

function request(path: string, method = 'GET', body?: unknown, token = 'synthetic-session', context = executionContext) {
  return app.request(path, {
    method,
    headers: { ...headers, Authorization: `Bearer ${token}` },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  }, env, context);
}

beforeEach(() => {
  project = { id: 'project-a', user_id: 'owner-a', check_schedule: 'weekly', last_scheduled_check: '2026-10-01 06:00:00' };
  brandConfig = {
    brand_name: 'Example Product', brand_aliases: '[]', brand_url: 'https://example.test', competitors: '[]',
    ai_endpoint_url: 'https://example.test/completions', ai_api_key: 'synthetic-secret', ai_model: 'synthetic-model',
  };
  managedRequests = [];
  managedResponse = async (request) => {
    managedRequests.push(request);
    return Response.json({
      model: 'observed-managed-model',
      choices: [{ message: { content: 'Example Product supports this. https://example.test/docs' } }],
    });
  };
  pending = [];
  db = createDb();
  vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
});

describe('owner-bound portfolio projects', () => {
  it('creates a trimmed named project owned by the session, ignoring a supplied owner', async () => {
    const response = await request('/v1/projects', 'POST', { name: '  PostTrainLLM  ', user_id: 'other-owner', slug: 'injected' });
    expect(response.status).toBe(201);
    const { project: created } = await response.json() as { project: Record<string, unknown> };
    expect(created).toMatchObject({ name: 'PostTrainLLM', user_id: 'owner-a', check_schedule: null });
    expect(created.slug).toBe(`project-${created.id}`);
    expect(db.createProject).toHaveBeenCalledOnce();
  });

  it.each([null, [], {}, { name: 42 }, { name: '' }, { name: '  ' }, { name: 'a'.repeat(121) }])('rejects invalid creation input %j', async (body) => {
    expect((await request('/v1/projects', 'POST', body)).status).toBe(400);
    expect(db.createProject).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON without creating a project', async () => {
    const response = await app.request('/v1/projects', { method: 'POST', headers, body: '{' }, env);
    expect(response.status).toBe(400);
    expect(db.createProject).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated creation', async () => {
    const response = await app.request('/v1/projects', { method: 'POST', body: JSON.stringify({ name: 'Brand' }) }, env);
    expect(response.status).toBe(401);
    expect(db.createProject).not.toHaveBeenCalled();
  });

  it('rejects creation with a read-only API key', async () => {
    expect((await request('/v1/projects', 'POST', { name: 'Brand' }, 'mp_live_synthetic')).status).toBe(403);
    expect(db.createProject).not.toHaveBeenCalled();
  });

  it('lists only the authenticated owner and preserves existing projects', async () => {
    expect((await request('/v1/projects')).status).toBe(200);
    expect(db.listProjectsByUser).toHaveBeenCalledWith('owner-a');
    expect(db.createProject).not.toHaveBeenCalled();
  });
});

describe('persistent schedule settings', () => {
  it('returns stored schedule and readiness without returning credential values', async () => {
    const response = await request('/v1/brands/project-a/schedule');
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ schedule: 'weekly', last_scheduled_check: '2026-10-01 06:00:00', source: 'byok', endpoint_configured: true, prompt_count: 1, badge_enabled: false });
    expect(JSON.stringify(body)).not.toContain('synthetic-secret');
    expect(JSON.stringify(body)).not.toContain('example.test');
  });

  it('reports free-ai as the runnable default only when no custom fields are present', async () => {
    brandConfig = { brand_name: 'Example Product', ai_endpoint_url: null, ai_api_key: null, ai_model: null };
    const response = await request('/v1/brands/project-a/schedule');
    expect(await response.json()).toMatchObject({ source: 'free-ai', endpoint_configured: true, prompt_count: 1 });

    brandConfig = { brand_name: 'Example Product', ai_endpoint_url: 'https://custom.example', ai_api_key: null, ai_model: null };
    const incomplete = await request('/v1/brands/project-a/schedule');
    expect(await incomplete.json()).toMatchObject({ source: null, endpoint_configured: false });
  });

  it('reads a saved schedule after an update', async () => {
    expect((await request('/v1/brands/project-a/schedule', 'PATCH', { schedule: 'daily' })).status).toBe(200);
    expect(db.updateProjectSchedule).toHaveBeenCalledWith('project-a', 'daily');
    const saved = await request('/v1/brands/project-a/schedule');
    expect(await saved.json()).toMatchObject({ schedule: 'daily' });
  });

  it.each([{}, null, [], { schedule: '' }, { schedule: 'hourly' }, { schedule: false }])('rejects invalid schedule input %j without changing it', async (body) => {
    expect((await request('/v1/brands/project-a/schedule', 'PATCH', body)).status).toBe(400);
    expect(db.updateProjectSchedule).not.toHaveBeenCalled();
    expect(project.check_schedule).toBe('weekly');
  });

  it('rejects malformed JSON without disabling an existing schedule', async () => {
    const response = await app.request('/v1/brands/project-a/schedule', { method: 'PATCH', headers, body: '{' }, env);
    expect(response.status).toBe(400);
    expect(db.updateProjectSchedule).not.toHaveBeenCalled();
  });

  it.each(['ai_endpoint_url', 'ai_api_key', 'ai_model'])('refuses enabling recurrence without %s', async (field) => {
    const config = { ai_endpoint_url: 'https://example.test', ai_api_key: 'synthetic-secret', ai_model: 'synthetic-model', [field]: null };
    db.getBrandConfig.mockResolvedValue(config as never);
    expect((await request('/v1/brands/project-a/schedule', 'PATCH', { schedule: 'weekly' })).status).toBe(400);
    expect(db.updateProjectSchedule).not.toHaveBeenCalled();
  });

  it('refuses enabling recurrence without prompts', async () => {
    db.listPrompts.mockResolvedValue([]);
    expect((await request('/v1/brands/project-a/schedule', 'PATCH', { schedule: 'weekly' })).status).toBe(400);
    expect(db.updateProjectSchedule).not.toHaveBeenCalled();
  });

  it('allows recurring managed checks for a complete profile with at least one prompt', async () => {
    brandConfig = { brand_name: 'Example Product', ai_endpoint_url: null, ai_api_key: null, ai_model: null };
    expect((await request('/v1/brands/project-a/schedule', 'PATCH', { schedule: 'weekly' })).status).toBe(200);
    expect(db.updateProjectSchedule).toHaveBeenCalledWith('project-a', 'weekly');
  });

  it('does not silently fall back from incomplete custom setup when enabling recurrence', async () => {
    brandConfig = { brand_name: 'Example Product', ai_endpoint_url: 'https://custom.example', ai_api_key: null, ai_model: null };
    const response = await request('/v1/brands/project-a/schedule', 'PATCH', { schedule: 'weekly' });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining('Custom AI setup is incomplete') });
    expect(db.updateProjectSchedule).not.toHaveBeenCalled();
  });

  it('allows explicitly turning recurrence off even when setup is incomplete', async () => {
    db.getBrandConfig.mockResolvedValue(null as never);
    db.listPrompts.mockResolvedValue([]);
    expect((await request('/v1/brands/project-a/schedule', 'PATCH', { schedule: null })).status).toBe(200);
    expect(db.updateProjectSchedule).toHaveBeenCalledWith('project-a', null);
    expect(db.getBrandConfig).not.toHaveBeenCalled();
  });

  it.each(['GET', 'PATCH'])('rejects another owner for %s before accessing settings', async (method) => {
    project.user_id = 'owner-b';
    expect((await request('/v1/brands/project-a/schedule', method, method === 'PATCH' ? { schedule: null } : undefined)).status).toBe(403);
    expect(db.getBrandConfig).not.toHaveBeenCalled();
    expect(db.updateProjectSchedule).not.toHaveBeenCalled();
  });
});

describe('manual project checks using managed AI', () => {
  it('rejects unauthenticated and foreign-owner check requests before loading brand state', async () => {
    const unauthenticated = await app.request('/v1/checks/project-a', { method: 'POST' }, env, executionContext);
    expect(unauthenticated.status).toBe(401);

    project.user_id = 'owner-b';
    expect((await request('/v1/checks/project-a', 'POST')).status).toBe(403);
    expect(db.getBrandConfig).not.toHaveBeenCalled();
    expect(db.createCheck).not.toHaveBeenCalled();
  });

  it('runs a project with no custom endpoint through the managed gateway and stores complete evidence', async () => {
    brandConfig = {
      brand_name: 'Example Product', brand_aliases: '[]', brand_url: 'example.test', competitors: '[]',
      ai_endpoint_url: null, ai_api_key: null, ai_model: null,
    };
    const response = await request('/v1/checks/project-a', 'POST');
    expect(response.status).toBe(201);
    await Promise.all(pending);
    expect(managedRequests).toHaveLength(1);
    expect(new URL(managedRequests[0].url).pathname).toBe('/v1/chat/completions');
    expect(db.createCheck).toHaveBeenCalledOnce();
    expect(db.createResult).toHaveBeenCalledWith(expect.objectContaining({
      project_id: 'project-a', prompt_id: 'prompt-a', prompt_text: 'Which product supports this use case?',
      platform: 'free-ai', model: 'observed-managed-model', provider_status: 'success',
      response_text: 'Example Product supports this. https://example.test/docs',
      citations: '["https://example.test/docs"]', brand_cited: true,
    }));
  });
});
