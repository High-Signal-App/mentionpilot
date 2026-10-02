import type { CompetitorResult, ResultRecord } from '@mentionpilot/shared';

// D1 returns these columns as JSON strings; older records may be incomplete.
type StoredReportResult = Omit<ResultRecord, 'citations' | 'competitors_mentioned'> & {
  citations?: unknown;
  competitors_mentioned?: unknown;
};

type EvidenceField = 'citations' | 'competitors_mentioned';
interface EvidenceWarning {
  field: EvidenceField;
  reason: 'missing' | 'invalid_json' | 'invalid_shape';
  raw_value: unknown;
}

function readEvidenceArray<T>(
  field: EvidenceField,
  raw: unknown,
  isItem: (value: unknown) => value is T,
  warnings: EvidenceWarning[],
): T[] | null {
  let value = raw;
  let reason: EvidenceWarning['reason'] | null = null;
  if (raw === null || raw === undefined) {
    reason = 'missing';
  } else if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      reason = 'invalid_json';
    }
  }
  if (!reason && (!Array.isArray(value) || !value.every(isItem))) {
    reason = 'invalid_shape';
  }
  if (reason) {
    warnings.push({ field, reason, raw_value: raw ?? null });
    return null;
  }
  return value as T[];
}

function isCompetitor(value: unknown): value is CompetitorResult {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.name === 'string'
    && typeof item.mentioned === 'boolean'
    && (item.position === null || (
      typeof item.position === 'number' && Number.isFinite(item.position)
    ));
}

export function serializeReportResult(result: StoredReportResult) {
  const warnings: EvidenceWarning[] = [];
  const citations = readEvidenceArray(
    'citations', result.citations,
    (value): value is string => typeof value === 'string', warnings,
  );
  const competitors = readEvidenceArray(
    'competitors_mentioned', result.competitors_mentioned, isCompetitor, warnings,
  );

  return {
    id: result.id,
    check_id: result.check_id,
    prompt_id: result.prompt_id,
    prompt: result.prompt_text,
    platform: result.platform,
    model: result.model,
    provider_status: result.provider_status,
    error_message: result.error_message,
    response_text: result.response_text,
    // This is the stored result's timestamp, not the report generation time.
    created_at: result.created_at,
    citations,
    competitors_mentioned: competitors?.map(({ name, mentioned, position }) => ({
      name, mentioned, position,
    })) ?? null,
    brand_mentioned: !!result.brand_mentioned,
    brand_sentiment: result.brand_sentiment,
    brand_position: result.brand_position,
    brand_cited: !!result.brand_cited,
    latency_ms: result.latency_ms,
    evidence_warnings: warnings,
  };
}
