import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../db';
import { reports } from '../routes/reports';
import type { Bindings, Variables } from '../types';
import type { CheckRecord } from '@mentionpilot/shared';
import type { serializeReportResult } from '../lib/report-evidence';

interface ReportPayload {
  report: {
    generated_at: string;
    latest_check: (CheckRecord & { results: ReturnType<typeof serializeReportResult>[] }) | null;
    summary: { mention_rate: number | null; total_checks: number; total_prompts: number };
    check_history: unknown[];
  };
}

function readReport(response: Response): Promise<ReportPayload> {
  return response.json() as Promise<ReportPayload>;
}

vi.mock('../db', () => ({ getDb: vi.fn() }));

const project = {
  id: 'synthetic-project', user_id: 'synthetic-owner', name: 'Example Product',
  slug: 'example-product', created_at: '2026-10-01 08:00:00',
  updated_at: '2026-10-01 08:00:00',
};
const check = {
  id: 'synthetic-check', project_id: project.id, status: 'completed',
  total_queries: 2, completed_queries: 2, brand_mention_rate: 1,
  summary: 'One available response; one provider error.',
  created_at: '2026-10-01 09:00:00', completed_at: '2026-10-01 09:00:03',
};
const longResponse = `${'Synthetic response for export testing. '.repeat(30)}\nhttps://example.test/product\nhttps://example.test/docs`;
const storedResult = {
  id: 'synthetic-result', check_id: check.id, project_id: project.id,
  prompt_id: 'synthetic-prompt', prompt_text: 'Which product supports this use case?',
  platform: 'custom', model: 'synthetic-model-not-a-live-provider',
  provider_status: 'success', error_message: null, response_text: longResponse,
  brand_mentioned: 1, brand_sentiment: 'neutral', brand_position: 1,
  competitors_mentioned: JSON.stringify([{ name: 'Example Alternative', mentioned: true, position: 2 }]),
  citations: JSON.stringify(['https://example.test/product', 'https://example.test/docs']),
  brand_cited: 1, latency_ms: 1200, created_at: '2026-10-01 09:00:01',
  private_extra_column: 'synthetic-private-value',
};
const errorResult = {
  ...storedResult, id: 'synthetic-error', prompt_id: 'synthetic-prompt-2',
  prompt_text: 'Compare this product with an alternative.',
  provider_status: 'error', error_message: 'Synthetic provider timeout',
  response_text: '', brand_mentioned: 0, brand_sentiment: null,
  brand_position: null, competitors_mentioned: '[]', citations: '[]',
  brand_cited: 0, latency_ms: null, created_at: '2026-10-01 09:00:02',
};

function createDb() {
  return {
    getSessionByTokenHash: vi.fn().mockResolvedValue({ user_id: project.user_id }),
    getProjectById: vi.fn().mockResolvedValue(project),
    getBrandConfig: vi.fn().mockResolvedValue({
      brand_name: project.name, brand_url: 'https://example.test',
      ai_api_key: 'synthetic-secret-must-not-export',
    }),
    listChecks: vi.fn().mockResolvedValue([check]),
    listPrompts: vi.fn().mockResolvedValue([{ id: 'synthetic-prompt' }, { id: 'synthetic-prompt-2' }]),
    listResults: vi.fn().mockResolvedValue([storedResult, errorResult]),
  };
}

let db: ReturnType<typeof createDb>;
let fetchSpy: ReturnType<typeof vi.fn>;
const env: Bindings = { DB: {} as D1Database, ENVIRONMENT: 'test' };
const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
app.route('/v1/reports', reports);

function generate(token: string | null = 'synthetic-session') {
  return app.request(`/v1/reports/${project.id}/generate`, {
    method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {},
  }, env);
}

beforeEach(() => {
  db = createDb();
  vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
  fetchSpy = vi.fn().mockRejectedValue(new Error('Unexpected network request'));
  vi.stubGlobal('fetch', fetchSpy);
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-02T12:00:00Z'));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('authenticated evidence report export', () => {
  it('exports complete stored answers and sources without collecting new evidence or leaking configuration', async () => {
    const response = await generate();
    expect(response.status).toBe(200);
    const body = await readReport(response);
    const result = body.report.latest_check!.results[0];
    expect(result.response_text).toBe(longResponse);
    expect(result.response_text.length).toBeGreaterThan(500);
    expect(result).toEqual({
      id: storedResult.id, check_id: check.id, prompt_id: storedResult.prompt_id,
      prompt: storedResult.prompt_text, platform: 'custom', model: storedResult.model,
      provider_status: 'success', error_message: null, response_text: longResponse,
      created_at: storedResult.created_at,
      citations: ['https://example.test/product', 'https://example.test/docs'],
      competitors_mentioned: [{ name: 'Example Alternative', mentioned: true, position: 2 }],
      brand_mentioned: true, brand_sentiment: 'neutral', brand_position: 1,
      brand_cited: true, latency_ms: 1200, evidence_warnings: [],
    });
    expect(body.report.generated_at).toBe('2026-10-02T12:00:00.000Z');
    expect(body.report.latest_check!.created_at).toBe(check.created_at);
    expect(body.report.summary).toEqual({ mention_rate: 1, total_checks: 1, total_prompts: 2 });
    expect(JSON.stringify(body)).not.toContain('synthetic-secret-must-not-export');
    expect(JSON.stringify(body)).not.toContain('synthetic-private-value');
    expect(db.listChecks).toHaveBeenCalledWith(project.id, 5);
    expect(db.listResults).toHaveBeenCalledWith(check.id);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(storedResult.citations).toBe('["https://example.test/product","https://example.test/docs"]');
    await expect(JSON.stringify({
      example_type: 'Synthetic test data only; no live AI observations or customer results.',
      ...body,
    }, null, 2) + '\n').toMatchFileSnapshot('../../../../docs/examples/evidence-report.synthetic.json');
  });

  it('retains explicit provider errors alongside successful observations', async () => {
    const body = await readReport(await generate());
    expect(body.report.latest_check!.results).toHaveLength(2);
    expect(body.report.latest_check!.results[1]).toMatchObject({
      id: 'synthetic-error', provider_status: 'error', error_message: 'Synthetic provider timeout',
      response_text: '', model: errorResult.model, created_at: errorResult.created_at,
      citations: [], competitors_mentioned: [], brand_mentioned: false,
      evidence_warnings: [],
    });
    expect(body.report.summary.mention_rate).toBe(1);
  });

  it.each([
    { raw: '[broken', reason: 'invalid_json' },
    { raw: '{"not":"an array"}', reason: 'invalid_shape' },
    { raw: '["https://example.test", 7]', reason: 'invalid_shape' },
    { raw: null, reason: 'missing' },
    { raw: undefined, reason: 'missing' },
  ])('exposes unknown citation evidence instead of replacing it with an empty list: $reason ($raw)', async ({ raw, reason }) => {
    db.listResults.mockResolvedValue([{ ...storedResult, citations: raw }] as any);
    const body = await readReport(await generate());
    expect(body.report.latest_check!.results[0]).toMatchObject({
      citations: null, evidence_warnings: [{ field: 'citations', reason, raw_value: raw ?? null }],
    });
  });

  it('rejects malformed competitor evidence without inventing observations', async () => {
    const raw = JSON.stringify([{ name: 'Example Alternative', mentioned: 'yes', position: null }]);
    db.listResults.mockResolvedValue([{ ...storedResult, competitors_mentioned: raw }]);
    const body = await readReport(await generate());
    expect(body.report.latest_check!.results[0]).toMatchObject({
      competitors_mentioned: null,
      evidence_warnings: [{ field: 'competitors_mentioned', reason: 'invalid_shape', raw_value: raw }],
    });
  });

  it('accepts decoded arrays and whitelists competitor fields', async () => {
    db.listResults.mockResolvedValue([{
      ...storedResult, citations: [],
      competitors_mentioned: [{ name: 'Example Alternative', mentioned: false, position: null, private_extra: 'omit-me' }],
    }] as any);
    const body = await readReport(await generate());
    expect(body.report.latest_check!.results[0]).toMatchObject({
      citations: [], competitors_mentioned: [{ name: 'Example Alternative', mentioned: false, position: null }],
      evidence_warnings: [],
    });
    expect(JSON.stringify(body)).not.toContain('omit-me');
  });

  it('preserves a running check and its incomplete coverage without inferring completion', async () => {
    db.listChecks.mockResolvedValue([{ ...check, status: 'running', completed_queries: 1, completed_at: null }] as any);
    db.listResults.mockResolvedValue([storedResult]);
    const body = await readReport(await generate());
    expect(body.report.latest_check).toMatchObject({ status: 'running', total_queries: 2, completed_queries: 1, completed_at: null });
    expect(body.report.latest_check!.results).toHaveLength(1);
  });

  it('returns an empty report when no observations exist', async () => {
    db.listChecks.mockResolvedValue([]);
    const body = await readReport(await generate());
    expect(body.report.latest_check).toBeNull();
    expect(body.report.check_history).toEqual([]);
    expect(body.report.summary.mention_rate).toBeNull();
    expect(db.listResults).not.toHaveBeenCalled();
  });

  it('rejects a request without a session before reading evidence', async () => {
    const response = await generate(null);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
    expect(db.getProjectById).not.toHaveBeenCalled();
    expect(db.listResults).not.toHaveBeenCalled();
  });

  it('rejects an invalid session before reading evidence', async () => {
    db.getSessionByTokenHash.mockResolvedValue(null as any);
    const response = await generate();
    expect(response.status).toBe(401);
    expect(db.getProjectById).not.toHaveBeenCalled();
    expect(db.listResults).not.toHaveBeenCalled();
  });

  it('denies another owner access without loading project configuration or results', async () => {
    db.getProjectById.mockResolvedValue({ ...project, user_id: 'different-owner' });
    const response = await generate();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Forbidden' });
    expect(db.getBrandConfig).not.toHaveBeenCalled();
    expect(db.listChecks).not.toHaveBeenCalled();
    expect(db.listResults).not.toHaveBeenCalled();
  });
});
