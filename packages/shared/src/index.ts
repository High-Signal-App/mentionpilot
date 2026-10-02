// ─── Platforms ───────────────────────────────────────────────

export type AIPlatform = 'openai' | 'anthropic' | 'google' | 'perplexity' | 'custom' | 'free-ai';
export type Sentiment = 'positive' | 'neutral' | 'negative';

// ─── Records ────────────────────────────────────────────────

export interface UserRecord {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface ProjectRecord {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface Competitor {
  name: string;
  url?: string;
}

export interface BrandConfigRecord {
  id: string;
  project_id: string;
  brand_name: string;
  brand_aliases: string[];
  brand_url: string | null;
  competitors: Competitor[];
  keywords: string[];
  target_customer: string | null;
  monitoring_topics: string[];
  reddit_communities: string[];
  platforms: AIPlatform[];
  has_openai_key: boolean;
  has_anthropic_key: boolean;
  has_google_key: boolean;
  has_perplexity_key: boolean;
  ai_endpoint_url: string | null;
  has_ai_api_key: boolean;
  ai_model: string | null;
  created_at: string;
  updated_at: string;
}

export interface PromptRecord {
  id: string;
  project_id: string;
  prompt_text: string;
  category: string | null;
  created_at: string;
}

export interface CheckRecord {
  id: string;
  project_id: string;
  status: 'running' | 'completed' | 'failed';
  total_queries: number;
  completed_queries: number;
  brand_mention_rate: number | null;
  summary: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface CompetitorResult {
  name: string;
  mentioned: boolean;
  position: number | null;
}

export interface ResultRecord {
  id: string;
  check_id: string;
  project_id: string;
  prompt_id: string;
  prompt_text: string | null;
  platform: AIPlatform;
  model: string;
  provider_status: 'success' | 'error';
  error_message: string | null;
  response_text: string;
  brand_mentioned: boolean;
  brand_sentiment: Sentiment | null;
  brand_position: number | null;
  competitors_mentioned: CompetitorResult[];
  citations: string[];
  brand_cited: boolean;
  latency_ms: number | null;
  created_at: string;
}

// ─── API Requests ───────────────────────────────────────────

export interface CreateBrandConfigRequest {
  brand_name: string;
  brand_aliases?: string[];
  brand_url?: string;
  competitors?: Competitor[];
  keywords?: string[];
  target_customer?: string;
  monitoring_topics?: string[];
  reddit_communities?: string[];
  platforms?: AIPlatform[];
  openai_api_key?: string;
  anthropic_api_key?: string;
  google_api_key?: string;
  perplexity_api_key?: string;
  ai_endpoint_url?: string;
  ai_api_key?: string;
  ai_model?: string;
}

export interface UpdateBrandConfigRequest extends Partial<CreateBrandConfigRequest> {}

export interface CreatePromptRequest {
  prompt_text: string;
  category?: string;
}

export interface CreateProjectRequest {
  name: string;
}

// ─── Dashboard Aggregate ────────────────────────────────────

export interface DashboardData {
  config: BrandConfigRecord | null;
  prompts: PromptRecord[];
  recent_checks: CheckRecord[];
  latest_results: ResultRecord[];
}

// ─── Free Check ────────────────────────────────────────────

export interface FreeCheckResult {
  prompt: string;
  platform: string;
  model: string;
  brand_mentioned: boolean;
  brand_sentiment: string | null;
  brand_position: number | null;
  brand_cited: boolean;
  response_preview: string;
  latency_ms: number | null;
}

export interface FreeCheckRecord {
  id: string;
  domain: string;
  brand_name: string | null;
  status: 'running' | 'completed' | 'failed';
  mention_rate: number | null;
  results: FreeCheckResult[];
  created_at: string;
  completed_at: string | null;
}

export interface FreeCheckRequest {
  domain: string;
}

// ─── GEO Tools ─────────────────────────────────────────────

export interface GEOScore {
  overall: number;
  authority: number;
  readability: number;
  structure: number;
  recommendations: string[];
}

export interface CrawlabilityBot {
  name: string;
  user_agent: string;
  allowed: boolean;
  blocked_by: string | null;
}

export interface CrawlabilityResult {
  overall_accessible: boolean;
  bots: CrawlabilityBot[];
  robots_txt_found: boolean;
  robots_txt_content: string | null;
  llms_txt_found: boolean;
  recommendations: string[];
}

export interface SchemaAnalysis {
  found: { type: string; count: number }[];
  missing: { type: string; importance: string; description: string }[];
  total_schemas: number;
  recommendations: string[];
}

export interface LlmsTxtResult {
  content: string;
  sections: string[];
}

// ─── Badge ──────────────────────────────────────────────────

export interface BadgePlatformDetail {
  platform: string;
  mentioned: boolean;
}

export interface BadgeData {
  project_id: string;
  brand_name: string;
  score: number;
  grade: string;
  platforms_checked: number;
  platforms_mentioned: number;
  mention_rate: number;
  platform_details: BadgePlatformDetail[];
  last_checked: string;
  dashboard_url: string;
  cached_at: string;
}

// ─── HN Monitoring ─────────────────────────────────────────

export interface HNMention {
  id: string;
  title: string | null;
  url: string | null;
  author: string;
  text: string | null;
  story_title: string | null;
  story_url: string | null;
  points: number | null;
  num_comments: number | null;
  type: 'story' | 'comment';
  created_at: string;
  hn_url: string;
}

// ─── Brand Intelligence Inbox ─────────────────────────────────────

export type FindingSource = 'hackernews' | 'reddit_insights';
export type FindingStatus = 'new' | 'reviewed' | 'dismissed' | 'resolved';
export type FindingAction =
  | 'created'
  | 'reviewed'
  | 'dismissed'
  | 'resolved'
  | 'reopened'
  | 'task_created'
  | 'task_completed'
  | 'task_reopened';
export type SourceSyncStatus = 'ok' | 'partial' | 'failed' | 'unavailable' | 'planned';

export interface FindingRecord {
  id: string;
  project_id: string;
  source: FindingSource;
  source_record_id: string;
  source_name: string;
  title: string;
  content: string | null;
  url: string;
  author: string | null;
  published_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
  engagement_score: number | null;
  comment_count: number | null;
  relevance_score: number;
  intent: import('./brand-intelligence').CommunityOpportunityIntent;
  matched_keywords: string[];
  status: FindingStatus;
}

export interface FindingHistoryRecord {
  id: string;
  finding_id: string;
  project_id: string;
  action: FindingAction;
  note: string | null;
  created_at: string;
  finding_title?: string;
  finding_source?: FindingSource;
}

export interface FindingTaskRecord {
  id: string;
  finding_id: string;
  project_id: string;
  title: string;
  status: 'open' | 'completed';
  created_at: string;
  completed_at: string | null;
  finding_title?: string;
  finding_source?: FindingSource;
}

export interface SourceCoverageRecord {
  source: 'hackernews' | 'reddit_insights' | 'f5bot' | 'google_trends';
  label: string;
  status: SourceSyncStatus;
  records_seen: number;
  records_matched: number;
  source_updated_at: string | null;
  checked_at: string | null;
  message: string;
}

export interface SignalInboxSummary {
  total: number;
  new: number;
  reviewed: number;
  resolved: number;
  dismissed: number;
}

export interface SignalInboxMetrics {
  useful_finding_rate: number | null;
  actionable_findings: number;
  resolution_rate: number | null;
  refresh_count: number;
}

export interface SignalInboxResponse {
  findings: FindingRecord[];
  summary: SignalInboxSummary;
  coverage: SourceCoverageRecord[];
  history: FindingHistoryRecord[];
  tasks: FindingTaskRecord[];
  metrics: SignalInboxMetrics;
  perception: ReturnType<typeof import('./brand-intelligence').clusterCompetitorPerception>;
}

export * from './brand-intelligence';
