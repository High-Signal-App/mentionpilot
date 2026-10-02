"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Eye,
  Plus,
  Trash2,
  Play,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
  Key,
  RefreshCw,
} from "lucide-react";
import { useModelDiscovery } from "@/lib/use-model-discovery";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiFetch } from "@/lib/api-client";
import { useProject } from "@/lib/use-project";
import type {
  AIPlatform,
  BrandConfigRecord,
  PromptRecord,
  CheckRecord,
  ResultRecord,
  DashboardData,
} from "@mentionpilot/shared";

const PROVIDERS: Array<{ key: Exclude<AIPlatform, "custom">; label: string }> = [
  { key: "openai", label: "OpenAI" },
  { key: "anthropic", label: "Anthropic" },
  { key: "google", label: "Google AI" },
  { key: "perplexity", label: "Perplexity" },
];

function providerForEndpoint(endpoint: string | null): AIPlatform | null {
  if (!endpoint) return null;
  try {
    const hostname = new URL(endpoint).hostname.toLowerCase();
    if (hostname === "api.openai.com") return "openai";
    if (hostname === "api.anthropic.com") return "anthropic";
    if (hostname === "generativelanguage.googleapis.com") return "google";
    if (hostname === "api.perplexity.ai") return "perplexity";
    return "custom";
  } catch {
    return null;
  }
}

export default function MentionsPage() {
  const { projectId, loading: projectLoading } = useProject();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<BrandConfigRecord | null>(null);
  const [prompts, setPrompts] = useState<PromptRecord[]>([]);
  const [checks, setChecks] = useState<CheckRecord[]>([]);
  const [latestResults, setLatestResults] = useState<ResultRecord[]>([]);
  const [expandedResult, setExpandedResult] = useState<string | null>(null);

  // Config form
  const [brandName, setBrandName] = useState("");
  const [brandAliases, setBrandAliases] = useState("");
  const [brandUrl, setBrandUrl] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [keywords, setKeywords] = useState("");
  const [targetCustomer, setTargetCustomer] = useState("");
  const [monitoringTopics, setMonitoringTopics] = useState("");
  const [redditCommunities, setRedditCommunities] = useState("");
  const [aiEndpointUrl, setAiEndpointUrl] = useState("");
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [saving, setSaving] = useState(false);

  // Model discovery
  const {
    models: availableModels,
    loading: loadingModels,
    discover: discoverModelsHook,
  } = useModelDiscovery({ modelsApiUrl: "/api/ai/models" });
  const [showModelDropdown, setShowModelDropdown] = useState(false);

  // Prompt form
  const [newPrompt, setNewPrompt] = useState("");
  const [promptCategory, setPromptCategory] = useState("");
  const [addingPrompt, setAddingPrompt] = useState(false);

  // Check state
  const [runningCheck, setRunningCheck] = useState(false);
  const [pollingCheck, setPollingCheck] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await apiFetch<DashboardData>(
        `/v1/checks/${projectId}/dashboard`
      );
      setConfig(data.config);
      setPrompts(data.prompts);
      setChecks(data.recent_checks);
      setLatestResults(data.latest_results);

      if (data.config) {
        setBrandName(data.config.brand_name);
        setBrandAliases(data.config.brand_aliases.join(", "));
        setBrandUrl(data.config.brand_url || "");
        setCompetitors(
          data.config.competitors.map((c) => c.name).join(", ")
        );
        setKeywords(data.config.keywords.join(", "));
        setTargetCustomer(data.config.target_customer || "");
        setMonitoringTopics(data.config.monitoring_topics.join(", "));
        setRedditCommunities(data.config.reddit_communities.join(", "));
        setAiEndpointUrl(data.config.ai_endpoint_url || "");
        setAiModel(data.config.ai_model || "");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Poll for running check
  useEffect(() => {
    if (!pollingCheck) return;
    const interval = setInterval(async () => {
      try {
        const check = await apiFetch<
          CheckRecord & { results: ResultRecord[] }
        >(`/v1/checks/${projectId}/${pollingCheck}`);
        if (check.status !== "running") {
          setPollingCheck(null);
          setRunningCheck(false);
          loadDashboard();
        }
      } catch {
        setPollingCheck(null);
        setRunningCheck(false);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [pollingCheck, projectId, loadDashboard]);

  const discoverModels = async () => {
    const url = aiEndpointUrl.trim();
    const key = aiApiKey.trim();
    if (!url || !key) {
      setError("Enter the endpoint API key to fetch its models. Saved keys are never read back.");
      return;
    }

    setError(null);
    try {
      await discoverModelsHook(url, key);
      setShowModelDropdown(true);
    } catch (discoveryError) {
      setError((discoveryError as Error).message);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        brand_name: brandName,
        brand_aliases: brandAliases
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        brand_url: brandUrl || undefined,
        competitors: competitors
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((name) => ({ name })),
        keywords: keywords.split(",").map((s) => s.trim()).filter(Boolean),
        target_customer: targetCustomer || undefined,
        monitoring_topics: monitoringTopics.split(",").map((s) => s.trim()).filter(Boolean),
        reddit_communities: redditCommunities.split(",").map((s) => s.trim().replace(/^r\//i, "")).filter(Boolean),
      };
      if (aiEndpointUrl) payload.ai_endpoint_url = aiEndpointUrl;
      if (aiApiKey) payload.ai_api_key = aiApiKey;
      if (aiModel) payload.ai_model = aiModel;

      const updated = await apiFetch<BrandConfigRecord>(
        `/v1/brands/${projectId}/config`,
        { method: "POST", body: JSON.stringify(payload) }
      );
      setConfig(updated);
      setAiApiKey("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const addPrompt = async () => {
    if (!newPrompt.trim()) return;
    setAddingPrompt(true);
    setError(null);
    try {
      const prompt = await apiFetch<PromptRecord>(
        `/v1/prompts/${projectId}`,
        {
          method: "POST",
          body: JSON.stringify({
            prompt_text: newPrompt,
            category: promptCategory || undefined,
          }),
        }
      );
      setPrompts((prev) => [...prev, prompt]);
      setNewPrompt("");
      setPromptCategory("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAddingPrompt(false);
    }
  };

  const deletePrompt = async (id: string) => {
    try {
      await apiFetch(`/v1/prompts/${projectId}/${id}`, { method: "DELETE" });
      setPrompts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const runCheck = async () => {
    setRunningCheck(true);
    setError(null);
    try {
      const check = await apiFetch<CheckRecord>(
        `/v1/checks/${projectId}`,
        { method: "POST" }
      );
      setPollingCheck(check.id);
      setChecks((prev) => [check, ...prev]);
    } catch (err) {
      setError((err as Error).message);
      setRunningCheck(false);
    }
  };

  const viewCheck = async (checkId: string) => {
    try {
      const check = await apiFetch<
        CheckRecord & { results: ResultRecord[] }
      >(`/v1/checks/${projectId}/${checkId}`);
      setLatestResults(check.results);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (projectLoading || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const configuredProvider = providerForEndpoint(config?.ai_endpoint_url || null);
  const observedProviders = new Set(
    latestResults
      .filter((result) => result.provider_status === "success")
      .map((result) => result.platform)
  );
  const displayedCheck = checks.find((check) => check.id === latestResults[0]?.check_id) ?? checks[0];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          AI Mention Check
        </h1>
        <p className="text-muted-foreground">
          Check if AI assistants mention your product when users ask relevant
          questions.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Config */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Brand Configuration
          </CardTitle>
          <CardDescription>
            Save your brand profile, choose buyer questions, and inspect the returned answers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="brand-name">Brand Name *</Label>
              <Input
                id="brand-name"
                placeholder="Your Product"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand-url">Brand URL</Label>
              <Input
                id="brand-url"
                placeholder="https://yourproduct.com"
                value={brandUrl}
                onChange={(e) => setBrandUrl(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="brand-aliases">Aliases (comma-separated)</Label>
              <Input
                id="brand-aliases"
                placeholder="Alias 1, Alias 2"
                value={brandAliases}
                onChange={(e) => setBrandAliases(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand-competitors">Competitors (comma-separated, max 5)</Label>
              <Input
                id="brand-competitors"
                placeholder="Competitor A, Competitor B"
                value={competitors}
                onChange={(e) => setCompetitors(e.target.value)}
              />
            </div>
          </div>

          <Separator />

          <details className="mp-custom-endpoint mp-profile">
            <summary>Community signal profile (optional)</summary>
          <div>
            <p className="text-xs text-muted-foreground mt-1">
              Used to rank source-backed findings. Reddit communities must exist in the published Reddit Insights archive.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="target-customer">Target customer</Label>
              <Input
                id="target-customer"
                placeholder="B2B SaaS founders and marketing teams"
                value={targetCustomer}
                onChange={(e) => setTargetCustomer(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="keywords">Keywords (comma-separated)</Label>
              <Input
                id="keywords"
                placeholder="AI visibility, brand monitoring"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="monitoring-topics">Monitoring topics</Label>
              <Input
                id="monitoring-topics"
                placeholder="competitor comparisons, purchase intent"
                value={monitoringTopics}
                onChange={(e) => setMonitoringTopics(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reddit-communities">Reddit Insights communities (max 5)</Label>
              <Input
                id="reddit-communities"
                placeholder="SaaS, marketing, startups"
                value={redditCommunities}
                onChange={(e) => setRedditCommunities(e.target.value)}
              />
            </div>
          </div>

          </details>

          <Separator />

          <h4 className="text-sm font-medium flex items-center gap-2">
            <Key className="h-4 w-4" />
            AI check source
          </h4>
          <p className="text-xs text-muted-foreground">
            {config?.ai_endpoint_url || config?.ai_model || config?.has_ai_api_key
              ? "Saved custom settings are used for checks. Your endpoint, model and API key must all be configured."
              : "New brand profiles use Fleet free-ai without a personal API key. Save your brand name, add buyer questions, then run a check."}
          </p>
          <p className="text-xs text-muted-foreground">Free-ai uses a routed model and records its returned identity with the answer. It does not establish visibility across ChatGPT, Claude, Gemini or Perplexity consumer products.</p>
          <details className="mp-custom-endpoint" open={!!(config?.ai_endpoint_url || config?.ai_model || config?.has_ai_api_key)}>
            <summary>Use your own endpoint (optional)</summary>
            <p className="text-xs text-muted-foreground my-3">Use an OpenAI-compatible endpoint with your model and API key. Saved keys are never shown back. Provider costs depend on your account.</p>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ai-endpoint-url">
                Endpoint URL
                {config?.ai_endpoint_url && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    saved
                  </Badge>
                )}
              </Label>
              <Input
                id="ai-endpoint-url"
                placeholder="https://api.openai.com/v1/chat/completions"
                value={aiEndpointUrl}
                onChange={(e) => setAiEndpointUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-api-key">
                API Key
                {config?.has_ai_api_key && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    saved
                  </Badge>
                )}
              </Label>
              <Input
                id="ai-api-key"
                type="password"
                placeholder={
                  config?.has_ai_api_key ? "\u2022\u2022\u2022\u2022" : "sk-..."
                }
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="ai-model">
                  Model
                  {config?.ai_model && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      saved
                    </Badge>
                  )}
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={discoverModels}
                  disabled={loadingModels || !aiEndpointUrl.trim() || !aiApiKey.trim()}
                  className="h-7 text-xs"
                >
                  {loadingModels ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <RefreshCw className="h-3 w-3 mr-1" />
                  )}
                  Fetch Models
                </Button>
              </div>
              <Input
                id="ai-model"
                placeholder="gpt-4o-mini"
                value={aiModel}
                onChange={(e) => {
                  setAiModel(e.target.value);
                  setShowModelDropdown(false);
                }}
                onFocus={() => {
                  if (availableModels.length > 0) setShowModelDropdown(true);
                }}
              />
              {showModelDropdown && availableModels.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
                  {availableModels.map((modelId) => (
                    <button
                      key={modelId}
                      className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                      onClick={() => {
                        setAiModel(modelId);
                        setShowModelDropdown(false);
                      }}
                    >
                      <span className="truncate">{modelId}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-md border p-4 mt-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Provider evidence coverage</p>
                <p className="text-xs text-muted-foreground">
                  Direct endpoint coverage is shown below. Free-ai results retain their own source label and do not count as direct observations of these providers.
                </p>
              </div>
              {configuredProvider === "custom" && <Badge variant="secondary">Custom endpoint configured</Badge>}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-4">
              {PROVIDERS.map((provider) => {
                const observed = observedProviders.has(provider.key);
                const configured = configuredProvider === provider.key;
                return (
                  <div key={provider.key} className="flex items-center justify-between rounded border px-3 py-2 text-xs">
                    <span>{provider.label}</span>
                    <Badge variant={observed ? "default" : "secondary"}>
                      {observed ? "observed" : configured ? "configured" : "unavailable"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>

          </details>

          <div className="flex justify-end">
            <Button
              onClick={saveConfig}
              disabled={saving || !brandName.trim()}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Configuration
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Prompts */}
      <Card>
        <CardHeader>
          <CardTitle>Prompts</CardTitle>
          <CardDescription>
            Questions users might ask AI about your product category. Max 20.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {prompts.length > 0 && (
            <div className="space-y-2">
              {prompts.map((prompt) => (
                <div
                  key={prompt.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <div className="flex-1">
                    <span>{prompt.prompt_text}</span>
                    {prompt.category && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        {prompt.category}
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Delete prompt: ${prompt.prompt_text}`}
                    onClick={() => deletePrompt(prompt.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {prompts.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No prompts yet. Add prompts like &quot;What&apos;s the best
              feedback tool for SaaS?&quot;
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Input
              aria-label="Buyer question"
              placeholder="What's the best [category] tool?"
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addPrompt()}
              className="flex-1 min-w-[180px]"
            />
            <Input
              aria-label="Prompt category"
              placeholder="Category"
              value={promptCategory}
              onChange={(e) => setPromptCategory(e.target.value)}
              className="w-32"
            />
            <Button
              aria-label="Add prompt"
              onClick={addPrompt}
              disabled={addingPrompt || !newPrompt.trim()}
              size="sm"
            >
              {addingPrompt ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Run Check */}
      <div className="flex justify-center">
        <Button
          size="lg"
          onClick={runCheck}
          disabled={runningCheck || !config || prompts.length === 0}
          className="px-8"
        >
          {runningCheck ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Running Check...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Run AI Mention Check
            </>
          )}
        </Button>
      </div>

      {/* Results */}
      {latestResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Results</span>
              {displayedCheck?.brand_mention_rate !== null &&
                displayedCheck?.brand_mention_rate !== undefined && (
                  <Badge
                    variant={
                      displayedCheck.brand_mention_rate > 0.5
                        ? "default"
                        : "secondary"
                    }
                  >
                    {Math.round(displayedCheck.brand_mention_rate * 100)}% mention
                    rate
                  </Badge>
                )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {latestResults.map((result) => {
                const isExpanded = expandedResult === result.id;
                return (
                  <div key={result.id} className="rounded-md border">
                    <button
                      className="flex w-full items-center justify-between px-4 py-3 text-sm text-left hover:bg-muted/50 transition-colors"
                      onClick={() =>
                        setExpandedResult(isExpanded ? null : result.id)
                      }
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {result.brand_mentioned ? (
                          <Check className="h-4 w-4 text-green-500 shrink-0" />
                        ) : (
                          <X className="h-4 w-4 text-red-500 shrink-0" />
                        )}
                        <span className="truncate text-muted-foreground">
                          {result.prompt_text || prompts.find((p) => p.id === result.prompt_id)
                            ?.prompt_text || result.prompt_id}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {result.brand_position && (
                          <Badge variant="secondary">
                            #{result.brand_position}
                          </Badge>
                        )}
                        {result.brand_sentiment && (
                          <Badge
                            variant={
                              result.brand_sentiment === "positive"
                                ? "default"
                                : result.brand_sentiment === "negative"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {result.brand_sentiment}
                          </Badge>
                        )}
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="border-t px-4 py-3 space-y-3">
                        {result.provider_status === "error" ? (
                          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                            Provider unavailable: {result.error_message || "Unknown provider error"}
                          </div>
                        ) : (
                          <div className="text-sm whitespace-pre-wrap bg-muted/50 rounded-md p-3 max-h-64 overflow-y-auto">
                            {result.response_text}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="text-muted-foreground">
                            Model: {result.model}
                          </span>
                          {result.latency_ms && (
                            <span className="text-muted-foreground">
                              {result.latency_ms}ms
                            </span>
                          )}
                          <span className="text-muted-foreground">
                            Checked: {new Date(result.created_at).toLocaleString()}
                          </span>
                          {result.brand_cited && (
                            <Badge variant="outline" className="text-xs">
                              Cited
                            </Badge>
                          )}
                          {result.competitors_mentioned.filter(
                            (cm) => cm.mentioned
                          ).length > 0 && (
                            <span className="text-muted-foreground">
                              Competitors:{" "}
                              {result.competitors_mentioned
                                .filter((cm) => cm.mentioned)
                                .map((cm) => cm.name)
                                .join(", ")}
                            </span>
                          )}
                        </div>
                        {result.citations.length > 0 && (
                          <div className="space-y-1 text-xs">
                            <p className="font-medium">Citations retained from this response</p>
                            {result.citations.map((citation) => (
                              <a
                                key={citation}
                                href={citation}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block break-all text-primary underline-offset-2 hover:underline"
                              >
                                {citation}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* History */}
      {checks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Check History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {checks.map((check) => (
                <button
                  key={check.id}
                  className="flex w-full items-center justify-between rounded-md border px-4 py-3 text-sm hover:bg-muted/50 transition-colors text-left"
                  onClick={() => viewCheck(check.id)}
                >
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        check.status === "completed"
                          ? "default"
                          : check.status === "running"
                            ? "secondary"
                            : "destructive"
                      }
                    >
                      {check.status}
                    </Badge>
                    <span className="text-muted-foreground">
                      {new Date(check.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {check.brand_mention_rate !== null && (
                      <span className="font-medium">
                        {Math.round(check.brand_mention_rate * 100)}%
                      </span>
                    )}
                    <span className="text-muted-foreground">
                      {check.completed_queries}/{check.total_queries}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
