export interface Bindings {
  DB: D1Database;
  AI: Ai;
  NEURON_BUDGET?: import('./lib/ai-engine').NeuronBudgetNamespace;
  ENVIRONMENT: string;
  OPENAI_API_KEY?: string;
  GOOGLE_API_KEY?: string;
  OPENPAGERANK_API_KEY?: string;
  FREE_AI_ENDPOINT_URL?: string;
  FREE_AI_API_KEY?: string;
  FREE_AI_MODEL?: string;
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
