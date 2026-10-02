// AI query engine for MentionPilot
// Uses a single OpenAI-compatible endpoint configured by the user.

import type { AIPlatform } from '@mentionpilot/shared';

export type Sentiment = 'positive' | 'neutral' | 'negative';

export interface AiEndpointConfig {
  endpointUrl: string;
  apiKey: string;
  model: string;
}

export interface QueryEndpointOptions {
  json?: boolean;
  maxTokens?: number;
  projectId?: string;
}

export interface AiGatewayBinding {
  fetch(request: Request): Promise<Response>;
}

export const DEFAULT_WORKERS_AI_MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8-fast';
const WORKERS_AI_DAILY_NEURON_CAP = 9_500;
const DEFAULT_WORKERS_AI_OUTPUT_TOKENS = 512;
const MAX_WORKERS_AI_OUTPUT_TOKENS = 8_192;

// Exact IDs and rates from Cloudflare's Workers AI pricing table (checked 2026-10-02).
// Other IDs such as the former `...-instruct-fast` default stay absent: never infer aliases.
const PRICED_WORKERS_AI_MODELS: Record<string, { input: number; output: number }> = {
  '@cf/meta/llama-3.1-8b-instruct-fp8-fast': { input: 4_119, output: 34_868 },
};

export class SharedNeuronBudgetUnavailableError extends Error {
  constructor() {
    super('Workers AI is unavailable under the shared daily neuron budget.');
    this.name = 'SharedNeuronBudgetUnavailableError';
  }
}

export interface NeuronBudgetNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): {
    fetch(input: string, init: RequestInit): Promise<Response>;
  };
}

async function reserveWorkersAiNeurons(
  budget: NeuronBudgetNamespace | undefined,
  neurons: number,
): Promise<void> {
  try {
    if (!budget) throw new Error('budget binding unavailable');
    const response = await budget
      .get(budget.idFromName('global-budget'))
      .fetch('https://internal.local/try-debit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ neurons }),
      });
    if (response.status !== 200) throw new Error('budget request failed');
    const payload: unknown = await response.json();
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('budget receipt is not an object');
    }
    const result = payload as Record<string, unknown>;
    if (
      result.allowed !== true ||
      result.dayKey !== new Date().toISOString().slice(0, 10) ||
      result.retryAfter !== 0 ||
      !Number.isSafeInteger(result.used) ||
      Number(result.used) < neurons ||
      !Number.isSafeInteger(result.remaining) ||
      Number(result.remaining) < 0 ||
      Number(result.used) + Number(result.remaining) !== WORKERS_AI_DAILY_NEURON_CAP
    ) throw new Error('budget admission invalid');
  } catch {
    throw new SharedNeuronBudgetUnavailableError();
  }
}

function estimateWorkersAiNeurons(model: string, input: Record<string, unknown>): number {
  const price = PRICED_WORKERS_AI_MODELS[model];
  if (!price) throw new SharedNeuronBudgetUnavailableError();
  const maxTokens = input.max_tokens;
  if (!Number.isSafeInteger(maxTokens) || Number(maxTokens) < 1 || Number(maxTokens) > MAX_WORKERS_AI_OUTPUT_TOKENS) {
    throw new SharedNeuronBudgetUnavailableError();
  }
  let serialized: string;
  try {
    serialized = JSON.stringify(input);
  } catch {
    throw new SharedNeuronBudgetUnavailableError();
  }
  const inputBytes = new TextEncoder().encode(serialized).byteLength;
  const neurons = Math.max(1, Math.ceil(
    ((inputBytes * price.input + Number(maxTokens) * price.output) / 1_000_000) * 1.2,
  ));
  if (!Number.isSafeInteger(neurons) || neurons > WORKERS_AI_DAILY_NEURON_CAP) {
    throw new SharedNeuronBudgetUnavailableError();
  }
  return neurons;
}

export interface PlatformResponse {
  responseText: string;
  model: string;
  latencyMs: number;
}

export interface CompetitorMention {
  name: string;
  mentioned: boolean;
  position: number | null;
}

export interface AnalysisResult {
  brand_mentioned: boolean;
  brand_sentiment: Sentiment | null;
  brand_position: number | null;
  competitors_mentioned: CompetitorMention[];
  citations: string[];
  brand_cited: boolean;
}

export function detectAIPlatform(endpointUrl: string): AIPlatform {
  try {
    const hostname = new URL(endpointUrl).hostname.toLowerCase();
    if (hostname === 'api.openai.com') return 'openai';
    if (hostname === 'api.anthropic.com') return 'anthropic';
    if (hostname === 'generativelanguage.googleapis.com') return 'google';
    if (hostname === 'api.perplexity.ai') return 'perplexity';
  } catch {
    // Treat malformed or unrecognized endpoint URLs as custom evidence sources.
  }
  return 'custom';
}

// ---------------------------------------------------------------------------
// Query an OpenAI-compatible endpoint
// ---------------------------------------------------------------------------

export async function queryEndpoint(
  config: AiEndpointConfig,
  prompt: string,
  options: QueryEndpointOptions = {},
): Promise<PlatformResponse> {
  const start = Date.now();
  const res = await fetch(config.endpointUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: options.maxTokens ?? 1024,
      stream: false,
      ...(options.json ? { response_format: { type: 'json_object' } } : {}),
      ...(options.projectId ? { project_id: options.projectId } : {}),
    }),
    redirect: 'manual',
    signal: AbortSignal.timeout(30_000),
  });
  const latencyMs = Date.now() - start;

  if (res.status >= 300 && res.status < 400) {
    throw new Error(`AI endpoint refused redirect (${res.status})`);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI endpoint error (${res.status}): ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    model?: string;
  };

  const responseText =
    (json.choices?.[0]?.message?.content || '').slice(0, 4000);

  return {
    responseText,
    model: json.model || config.model,
    latencyMs,
  };
}

export async function queryManagedGateway(
  gateway: AiGatewayBinding | undefined,
  prompt: string,
  options: QueryEndpointOptions = {},
): Promise<PlatformResponse> {
  if (!gateway) throw new Error('Managed AI gateway is unavailable');
  const start = Date.now();
  const response = await gateway.fetch(new Request('https://fleet-gateway.internal/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer gateway-managed',
      'x-gateway-project-id': 'mentionpilot',
    },
    body: JSON.stringify({
      model: 'auto',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: options.maxTokens ?? 1024,
      stream: false,
      ...(options.json ? { response_format: { type: 'json_object' } } : {}),
      ...(options.projectId ? { project_id: options.projectId } : {}),
    }),
    signal: AbortSignal.timeout(30_000),
  }));
  if (!response.ok) throw new Error(`Managed AI gateway error (${response.status})`);
  const json = await response.json() as {
    choices?: Array<{ message?: { content?: unknown } }>;
    model?: string;
  };
  const responseText = typeof json.choices?.[0]?.message?.content === 'string'
    ? json.choices[0].message.content
    : '';
  if (!responseText) throw new Error('Managed AI gateway returned an empty response');
  const model = typeof json.model === 'string' && json.model.trim() ? json.model : 'unknown';
  return { responseText, model, latencyMs: Date.now() - start };
}

export async function queryWorkersAi(
  ai: Ai,
  promptText: string,
  budget: NeuronBudgetNamespace | undefined,
  model = DEFAULT_WORKERS_AI_MODEL,
): Promise<PlatformResponse> {
  const start = Date.now();
  const input = {
    messages: [{ role: 'user', content: promptText }],
    max_tokens: DEFAULT_WORKERS_AI_OUTPUT_TOKENS,
  };
  const neurons = estimateWorkersAiNeurons(model, input);
  await reserveWorkersAiNeurons(budget, neurons);
  const result = await ai.run(model, input);
  const responseText = typeof result.response === 'string' ? result.response : '';

  if (!responseText) {
    throw new Error('Workers AI returned an empty response');
  }

  return {
    responseText,
    model,
    latencyMs: Date.now() - start,
  };
}

// ---------------------------------------------------------------------------
// Analyze a response for brand mentions, sentiment, position, etc.
// ---------------------------------------------------------------------------

export function analyzeResponse(
  text: string,
  brandName: string,
  brandAliases: string[],
  brandUrl: string | null,
  competitors: { name: string }[]
): AnalysisResult {
  const allBrandTerms = [brandName, ...brandAliases];

  // -- Mention detection --
  const brand_mentioned = allBrandTerms.some((term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
  });

  // -- Position detection (numbered lists) --
  let brand_position: number | null = null;
  const listItemRegex = /^\s*(\d+)[.)]\s*\**\s*([^\n]+)/gm;
  let match;
  while ((match = listItemRegex.exec(text)) !== null) {
    const itemText = match[2];
    if (
      allBrandTerms.some((term) =>
        new RegExp(
          `\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
          'i'
        ).test(itemText)
      )
    ) {
      brand_position = parseInt(match[1], 10);
      break;
    }
  }

  // -- Sentiment analysis (keyword scan in brand-containing sentences) --
  let brand_sentiment: Sentiment | null = null;
  if (brand_mentioned) {
    const positiveWords = [
      'best', 'great', 'excellent', 'top', 'leading', 'popular', 'powerful',
      'recommended', 'outstanding', 'innovative', 'reliable', 'favorite', 'preferred',
    ];
    const negativeWords = [
      'worst', 'bad', 'poor', 'lacking', 'limited', 'expensive', 'outdated',
      'difficult', 'slow', 'unreliable', 'disappointing',
    ];

    const sentences = text.split(/[.!?]+/);
    const brandSentences = sentences.filter((s) =>
      allBrandTerms.some((term) =>
        new RegExp(
          `\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
          'i'
        ).test(s)
      )
    );
    const context = brandSentences.join(' ').toLowerCase();

    const posCount = positiveWords.filter((w) => context.includes(w)).length;
    const negCount = negativeWords.filter((w) => context.includes(w)).length;

    if (posCount > negCount) brand_sentiment = 'positive';
    else if (negCount > posCount) brand_sentiment = 'negative';
    else brand_sentiment = 'neutral';
  }

  // -- Competitor detection --
  const competitors_mentioned: CompetitorMention[] = competitors.map((comp) => {
    const escaped = comp.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const mentioned = new RegExp(`\\b${escaped}\\b`, 'i').test(text);
    let position: number | null = null;
    if (mentioned) {
      const listMatch = text.match(
        new RegExp(`^\\s*(\\d+)[.)]\\s*\\**\\s*[^\\n]*\\b${escaped}\\b`, 'im')
      );
      if (listMatch) position = parseInt(listMatch[1], 10);
    }
    return { name: comp.name, mentioned, position };
  });

  // -- Citation extraction --
  const urlRegex = /https?:\/\/[^\s)>\]"',]+/g;
  const citations = [...new Set(text.match(urlRegex) || [])];
  const brand_cited = brandUrl
    ? citations.some((url) =>
        url
          .toLowerCase()
          .includes(
            brandUrl
              .toLowerCase()
              .replace(/^https?:\/\//, '')
              .replace(/\/$/, '')
          )
      )
    : false;

  return {
    brand_mentioned,
    brand_sentiment,
    brand_position,
    competitors_mentioned,
    citations,
    brand_cited,
  };
}

// ---------------------------------------------------------------------------
// Orchestrator — run a full mention check
// ---------------------------------------------------------------------------

interface ConfigRow {
  ai_endpoint_url: string | null;
  ai_api_key: string | null;
  ai_model: string | null;
  brand_name: string;
  brand_aliases: string; // JSON stringified string[]
  brand_url: string | null;
  competitors: string; // JSON stringified { name: string }[]
}

export type MentionCheckSource = 'byok' | 'free-ai';

export type MentionCheckSourceResolution =
  | { source: MentionCheckSource; error: null }
  | { source: null; error: string };

/** Selects a configured custom endpoint or the existing managed gateway. */
export function resolveMentionCheckSource(
  config: Pick<ConfigRow, 'ai_endpoint_url' | 'ai_api_key' | 'ai_model' | 'brand_name'>,
  managedGateway: AiGatewayBinding | undefined,
): MentionCheckSourceResolution {
  if (!config.brand_name?.trim()) {
    return { source: null, error: 'Complete the brand profile before running AI checks.' };
  }

  const endpoint = config.ai_endpoint_url?.trim() || null;
  const apiKey = config.ai_api_key?.trim() || null;
  const model = config.ai_model?.trim() || null;
  const hasCustomSetup = !!(endpoint || apiKey || model);
  if (endpoint && apiKey && model) return { source: 'byok', error: null };
  if (hasCustomSetup) {
    return {
      source: null,
      error: 'Custom AI setup is incomplete. Finish configuring the endpoint URL, API key, and model.',
    };
  }
  if (!managedGateway) return { source: null, error: 'Managed AI is unavailable.' };
  return { source: 'free-ai', error: null };
}

interface PromptRow {
  id: string;
  prompt_text: string;
}

interface DbHandle {
  createResult(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  updateCheck(id: string, updates: Record<string, unknown>): Promise<void>;
}

export async function runMentionCheck(
  db: DbHandle,
  config: ConfigRow,
  prompts: PromptRow[],
  checkId: string,
  projectId: string,
  managedGateway?: AiGatewayBinding,
): Promise<void> {
  const brandAliases: string[] = JSON.parse(config.brand_aliases);
  const competitors: { name: string }[] = JSON.parse(config.competitors);

  const resolution = resolveMentionCheckSource(config, managedGateway);
  if (!resolution.source) {
    await db.updateCheck(checkId, {
      status: 'failed',
      summary: resolution.error,
      completed_at: new Date().toISOString(),
    });
    return;
  }

  const endpointConfig = resolution.source === 'byok' ? {
    endpointUrl: config.ai_endpoint_url!.trim(),
    apiKey: config.ai_api_key!.trim(),
    model: config.ai_model!.trim(),
  } : null;
  const platform: AIPlatform = resolution.source === 'byok'
    ? detectAIPlatform(endpointConfig!.endpointUrl)
    : 'free-ai';

  let completedQueries = 0;
  let mentionCount = 0;
  let successfulQueries = 0;
  let failedQueries = 0;

  try {
    for (const prompt of prompts) {
      try {
        const response = endpointConfig
          ? await queryEndpoint(endpointConfig, prompt.prompt_text)
          : await queryManagedGateway(managedGateway, prompt.prompt_text, { projectId: 'mentionpilot' });
        const analysis = analyzeResponse(
          response.responseText,
          config.brand_name,
          brandAliases,
          config.brand_url,
          competitors
        );

        await db.createResult({
          id: crypto.randomUUID(),
          check_id: checkId,
          project_id: projectId,
          prompt_id: prompt.id,
          prompt_text: prompt.prompt_text,
          platform,
          model: response.model,
          provider_status: 'success',
          error_message: null,
          response_text: response.responseText,
          brand_mentioned: analysis.brand_mentioned,
          brand_sentiment: analysis.brand_sentiment,
          brand_position: analysis.brand_position,
          competitors_mentioned: JSON.stringify(analysis.competitors_mentioned),
          citations: JSON.stringify(analysis.citations),
          brand_cited: analysis.brand_cited,
          latency_ms: response.latencyMs,
        });

        if (analysis.brand_mentioned) mentionCount++;
        successfulQueries++;
      } catch (err) {
        const errorMessage = (err as Error).message.slice(0, 500);
        await db.createResult({
          id: crypto.randomUUID(),
          check_id: checkId,
          project_id: projectId,
          prompt_id: prompt.id,
          prompt_text: prompt.prompt_text,
          platform,
          model: endpointConfig?.model ?? 'unknown',
          provider_status: 'error',
          error_message: errorMessage,
          response_text: '',
          brand_mentioned: false,
          brand_sentiment: null,
          brand_position: null,
          competitors_mentioned: '[]',
          citations: '[]',
          brand_cited: false,
          latency_ms: null,
        });
        failedQueries++;
      }

      completedQueries++;
      await db.updateCheck(checkId, { completed_queries: completedQueries });
    }

    const mentionRate = successfulQueries > 0 ? mentionCount / successfulQueries : null;
    await db.updateCheck(checkId, {
      status: successfulQueries > 0 ? 'completed' : 'failed',
      brand_mention_rate: mentionRate,
      summary: successfulQueries > 0
        ? `Brand mentioned in ${mentionCount}/${successfulQueries} available responses (${Math.round((mentionRate ?? 0) * 100)}%); ${failedQueries} provider ${failedQueries === 1 ? 'request was' : 'requests were'} unavailable.`
        : `Provider unavailable for all ${failedQueries} attempted queries.`,
      completed_at: new Date().toISOString(),
    });
  } catch (err) {
    await db.updateCheck(checkId, {
      status: 'failed',
      summary: `Check failed: ${(err as Error).message}`,
      completed_at: new Date().toISOString(),
    });
  }
}
