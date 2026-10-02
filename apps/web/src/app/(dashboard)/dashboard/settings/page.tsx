"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useProject } from "@/lib/use-project";
import { apiFetch } from "@/lib/api-client";
import { ApiKeysCard } from "@/components/api-keys-card";

type Schedule = "daily" | "weekly" | null;
interface MonitoringSettings {
  schedule: Schedule;
  last_scheduled_check: string | null;
  endpoint_configured: boolean;
  source: "free-ai" | "byok" | null;
  prompt_count: number;
  badge_enabled: boolean;
}

const WIDGET_BASE = process.env.NEXT_PUBLIC_API_URL || "https://mentionpilot-api.sarthakagrawal927.workers.dev";

export default function SettingsPage() {
  const { projectId, project } = useProject();
  const [settings, setSettings] = useState<MonitoringSettings | null>(null);
  const [schedule, setSchedule] = useState<Schedule>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState("");
  const [badgeBusy, setBadgeBusy] = useState(false);
  const [badgeError, setBadgeError] = useState<string | null>(null);
  const [badgeTheme, setBadgeTheme] = useState<"auto" | "light" | "dark">("auto");
  const [badgePosition, setBadgePosition] = useState<"inline" | "bottom-right" | "bottom-left">("inline");
  const [badgeSize, setBadgeSize] = useState<"sm" | "md">("sm");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    (async () => {
      try {
        const data = await apiFetch<MonitoringSettings>(`/v1/brands/${projectId}/schedule`);
        if (cancelled) return;
        if (data.schedule !== null && data.schedule !== "daily" && data.schedule !== "weekly") {
          throw new Error("The saved schedule is unsupported. No settings have been changed.");
        }
        setSettings(data);
        setSchedule(data.schedule);
      } catch (err) { if (!cancelled) setLoadError((err as Error).message); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [projectId, revision]);

  const ready = !!settings?.endpoint_configured && settings.prompt_count > 0;
  const dirty = !!settings && schedule !== settings.schedule;

  async function saveSchedule() {
    if (!projectId || saving || !dirty) return;
    setSaving(true);
    setSaveError(null);
    setSavedMessage("");
    try {
      const data = await apiFetch<{ schedule: Schedule }>(`/v1/brands/${projectId}/schedule`, {
        method: "PATCH", body: JSON.stringify({ schedule }),
      });
      setSettings((current) => current ? { ...current, schedule: data.schedule } : current);
      setSchedule(data.schedule);
      setSavedMessage("Schedule saved.");
    } catch (err) { setSaveError((err as Error).message); }
    finally { setSaving(false); }
  }

  async function toggleBadge() {
    if (!projectId || !settings || badgeBusy) return;
    setBadgeBusy(true);
    setBadgeError(null);
    try {
      const data = await apiFetch<{ badge_enabled: boolean }>(`/v1/brands/${projectId}/badge`, {
        method: "PATCH", body: JSON.stringify({ enabled: !settings.badge_enabled }),
      });
      setSettings((current) => current ? { ...current, badge_enabled: data.badge_enabled } : current);
    } catch (err) { setBadgeError((err as Error).message); }
    finally { setBadgeBusy(false); }
  }

  const snippetCode = useMemo(() => {
    const attrs = [`data-project-id="${projectId || "YOUR_PROJECT_ID"}"`];
    if (badgeTheme !== "auto") attrs.push(`data-theme="${badgeTheme}"`);
    if (badgePosition !== "inline") attrs.push(`data-position="${badgePosition}"`);
    if (badgeSize !== "sm") attrs.push(`data-size="${badgeSize}"`);
    return `<script\n  src="${WIDGET_BASE}/v1/badge/widget.js"\n  ${attrs.join("\n  ")}\n  async\n></script>`;
  }, [projectId, badgeTheme, badgePosition, badgeSize]);

  async function copySnippet() {
    try { await navigator.clipboard.writeText(snippetCode); setCopied(true); }
    catch { setBadgeError("Could not copy. Select the embed code below and copy it manually."); }
  }

  return <div>
    <h1>Monitoring &amp; settings</h1>
    <p className="mp-settings-copy mt-3">Keep a repeatable question set for {project?.name}. Review the original answers before deciding what to change.</p>

    <section className="mp-section" aria-labelledby="schedule-heading">
      <div className="mp-section-heading">
        <div><h2 id="schedule-heading">Scheduled checks</h2><p>{settings?.source === 'free-ai' ? 'Uses Fleet free-ai. The returned model is retained with each answer.' : settings?.source === 'byok' ? "Uses this brand's configured endpoint, model and API key." : 'Save the brand profile and prompts to use free-ai, or finish your custom endpoint setup.'}</p></div>
        <span className="mp-stamp">{loading ? "Loading saved state…" : loadError ? "State unavailable" : dirty ? "Unsaved change" : `${settings?.schedule ?? "Off"} · saved state`}</span>
      </div>
      {loadError ? <div role="alert"><p className="mp-error">{loadError}</p><Button variant="outline" className="mt-3" onClick={() => setRevision((n) => n + 1)}>Retry settings</Button></div> : <>
        <div className="mp-settings-grid">
          <div>
            <fieldset disabled={loading || saving}>
              <legend className="text-sm font-semibold mb-3">Check frequency</legend>
              <div className="flex flex-wrap gap-2">
                {([{ value: null, label: "Off" }, { value: "weekly", label: "Weekly" }, { value: "daily", label: "Daily" }] as const).map((option) =>
                  <Button key={option.label} type="button" aria-pressed={schedule === option.value}
                    variant={schedule === option.value ? "default" : "outline"}
                    disabled={option.value !== null && !ready}
                    onClick={() => { setSchedule(option.value); setSavedMessage(""); setSaveError(null); }}>
                    {option.label}
                  </Button>)}
              </div>
            </fieldset>
            <p className="mp-settings-copy mt-4">Checks run at 06:00 UTC. Weekly checks run on Monday. {settings?.source === "free-ai" ? "Free-ai uses the managed service; no personal API key is required. Availability is recorded per check." : "Custom provider cost depends on your endpoint and prompt count."}</p>
            <p className="mp-settings-copy mt-3">{settings?.last_scheduled_check ? `Last scheduled attempt: ${settings.last_scheduled_check} UTC` : "No scheduled attempt recorded."}</p>
          </div>
          <div className="mp-evidence-note">
            <strong>{loading ? "Reading saved setup…" : ready ? "Keep coverage explicit" : "Finish setup before scheduling"}</strong>
            <p>{ready ? `${settings?.prompt_count} saved prompts will run through ${settings?.source === 'free-ai' ? 'free-ai' : 'your configured model'}. API responses do not establish visibility across every consumer AI assistant.` : "Save a brand profile and at least one prompt. Free-ai is the default for new profiles; custom setup needs an endpoint, model and API key."}</p>
            <Link href="/dashboard/mentions">Review endpoint and prompts →</Link>
          </div>
        </div>
        <div className="mp-save-row">
          <Button disabled={loading || saving || !dirty || (schedule !== null && !ready)} onClick={saveSchedule}>{saving ? "Saving…" : "Save schedule"}</Button>
          {savedMessage && <p role="status" className="text-sm">{savedMessage}</p>}
          {dirty && !saving && !saveError && <p className="mp-settings-copy">Your change is not saved yet.</p>}
        </div>
        {saveError && <p role="alert" className="mp-error mt-3">{saveError}</p>}
      </>}
    </section>

    <section className="mp-section" aria-labelledby="alerts-heading">
      <div className="mp-section-heading"><div><h2 id="alerts-heading">Alerts</h2><p>Email and Slack delivery are not available yet. No notification settings are saved or messages sent here.</p></div><span className="mp-stamp">Unavailable</span></div>
      <Link href="/dashboard/social" className="underline underline-offset-4 text-sm">Review findings in the signal inbox →</Link>
    </section>

    <section className="mp-section" aria-labelledby="badge-heading">
      <div className="mp-section-heading"><div><h2 id="badge-heading">Public visibility badge</h2><p>Enables the existing public badge for this project. Publishing is optional.</p></div>
        <Button variant="outline" disabled={loading || !!loadError || !settings || badgeBusy} onClick={toggleBadge}>{badgeBusy ? "Updating…" : settings?.badge_enabled ? "Disable public badge" : "Enable public badge"}</Button>
      </div>
      {badgeError && <p role="alert" className="mp-error">{badgeError}</p>}
      {settings?.badge_enabled && <div className="mp-badge-controls">
        <div className="flex flex-wrap gap-5">
          <div><Label htmlFor="badge-theme">Theme</Label><select id="badge-theme" value={badgeTheme} onChange={(e) => { setBadgeTheme(e.target.value as typeof badgeTheme); setCopied(false); }}>{["auto", "light", "dark"].map((v) => <option key={v}>{v}</option>)}</select></div>
          <div><Label htmlFor="badge-position">Position</Label><select id="badge-position" value={badgePosition} onChange={(e) => { setBadgePosition(e.target.value as typeof badgePosition); setCopied(false); }}>{["inline", "bottom-right", "bottom-left"].map((v) => <option key={v}>{v}</option>)}</select></div>
          <div><Label htmlFor="badge-size">Size</Label><select id="badge-size" value={badgeSize} onChange={(e) => { setBadgeSize(e.target.value as typeof badgeSize); setCopied(false); }}>{["sm", "md"].map((v) => <option key={v}>{v}</option>)}</select></div>
        </div>
        <p className="mp-settings-copy">These choices update the embed code; place that code on your website to apply them.</p>
        <pre className="mp-snippet">{snippetCode}</pre>
        <div><Button variant="outline" onClick={copySnippet}>{copied ? "Copied" : "Copy embed code"}</Button></div>
      </div>}
    </section>

    <section className="mp-section"><ApiKeysCard /></section>
  </div>;
}
