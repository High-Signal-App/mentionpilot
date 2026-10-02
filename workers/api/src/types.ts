export interface Bindings {
  DB: D1Database;
  FREE_AI?: Fetcher;
  ENVIRONMENT: string;
  OPENAI_API_KEY?: string;
  GOOGLE_API_KEY?: string;
  OPENPAGERANK_API_KEY?: string;
  POSTHOG_API_KEY?: string;
  // App Health endpoint monitoring — inert until a private ingest key is set.
  APP_HEALTH_INGEST_KEY?: string;
  APP_HEALTH_ENVIRONMENT?: string;
}

export interface Variables {
  userId?: string;
  authMethod?: 'session' | 'api_key';
  requestId: string;
}
