"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CircleCheckBig, Loader2, Search, X } from "lucide-react";
import { API_BASE } from "@/lib/api-base";
import homeStyles from "../page.module.css";
import styles from "./check.module.css";

interface FreeCheckResult {
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

interface FreeCheckResponse {
  id?: string;
  brand_name?: string;
  status?: string;
  results?: FreeCheckResult[];
  mention_rate?: number | null;
  error?: string;
}

function isEvidence(value: unknown): value is FreeCheckResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  return ["prompt", "platform", "model", "response_preview"].every((key) => typeof result[key] === "string")
    && typeof result.brand_mentioned === "boolean"
    && typeof result.brand_cited === "boolean"
    && (result.brand_position === null || (typeof result.brand_position === "number" && Number.isFinite(result.brand_position)));
}

function Mark() {
  return (
    <svg viewBox="0 0 36 36" role="img" aria-label="MentionPilot mark">
      <circle cx="18" cy="18" r="15.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 20.5c4.5-6 13.5-6 18 0" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="18" cy="18" r="3.4" fill="currentColor" />
      <path d="M18 3v5M18 28v5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export default function FreeCheckPage() {
  const [clientReady, setClientReady] = useState(false);
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [brandName, setBrandName] = useState<string | null>(null);
  const [results, setResults] = useState<FreeCheckResult[]>([]);
  const [mentionRate, setMentionRate] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  useEffect(() => { setClientReady(true); }, []);

  const runCheck = async () => {
    if (!domain.trim()) return;
    setLoading(true);
    setError(null);
    setBrandName(null);
    setResults([]);
    setMentionRate(null);
    setExpandedIdx(null);

    const deadline = Date.now() + 180_000;
    const request = async (path: string, init?: RequestInit) => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error("The check timed out. You can retry.");
      const signal = AbortSignal.timeout(Math.min(remaining, init ? 120_000 : 30_000));
      try {
        const response = await fetch(path, { ...init, signal });
        if (!response.ok) throw new Error(`The check service is unavailable (${response.status}). You can retry.`);
        return await response.json() as FreeCheckResponse | null;
      } catch (error) {
        if (signal.aborted) throw new Error("The check timed out. You can retry.");
        throw error;
      }
    };

    try {
      const startData = await request(`${API_BASE}/v1/free-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domain.trim() }),
      });
      if (!startData || typeof startData.id !== "string" || !startData.id || typeof startData.brand_name !== "string") {
        throw new Error("The check service returned an invalid response. You can retry.");
      }
      setBrandName(startData.brand_name);

      while (true) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const data = await request(`${API_BASE}/v1/free-check/${encodeURIComponent(startData.id)}`);
        if (!data || typeof data.status !== "string" || !["running", "completed", "failed"].includes(data.status)) {
          throw new Error("The check service returned an unknown status. You can retry.");
        }
        if (data.status === "running") continue;
        if (data.status === "failed") {
          setResults(Array.isArray(data.results) ? data.results.filter(isEvidence) : []);
          setError(typeof data.error === "string" ? data.error : "The check did not return enough evidence for a reliable score.");
        } else {
          const rate = data.mention_rate;
          if (!Array.isArray(data.results) || data.results.length === 0 || !data.results.every(isEvidence) || !(rate === null || (typeof rate === "number" && Number.isFinite(rate) && rate >= 0 && rate <= 1))) {
            throw new Error("The check service returned incomplete evidence. You can retry.");
          }
          setResults(data.results);
          setMentionRate(rate);
        }
        break;
      }
    } catch (caughtError) {
      setError((caughtError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const mentionPercent = mentionRate === null ? null : Math.round(mentionRate * 100);
  const mentionStatus = mentionRate === null
    ? ""
    : mentionRate > 0.5
      ? "Good visibility"
      : mentionRate > 0
        ? "Low visibility"
        : "Not mentioned";

  return (
    <div className={homeStyles.page}>
      <header className={homeStyles.header}>
        <div className={homeStyles.headerInner}>
          <Link href="/" className={homeStyles.brand} aria-label="MentionPilot home">
            <span className={homeStyles.mark}><Mark /></span>
            <span>MentionPilot</span>
          </Link>
          <div className={`${homeStyles.headerActions} ${styles.headerActions}`}>
            <Link href="/login" className={homeStyles.signIn}>Sign in</Link>
            <Link href="/" className={homeStyles.headerCta}>Return to brief</Link>
          </div>
        </div>
      </header>

      <main className={styles.checkMain}>
        <aside className={styles.intro}>
          <p className={styles.eyebrow}>Public evidence check / 01</p>
          <h1>Put one brand answer on the record.</h1>
          <p className={styles.introCopy}>
            Enter the canonical domain. MentionPilot reads the site, creates relevant discovery questions, runs a live model check, and keeps the answer behind the result.
          </p>

          <dl className={styles.promiseList}>
            <div>
              <dt>01</dt>
              <dd><strong>Real inference</strong><span>A model response, not a fixture.</span></dd>
            </div>
            <div>
              <dt>02</dt>
              <dd><strong>Inspectable evidence</strong><span>Questions and response excerpts stay visible.</span></dd>
            </div>
            <div>
              <dt>03</dt>
              <dd><strong>Honest coverage</strong><span>Failed checks stay explicit and out of the score.</span></dd>
            </div>
          </dl>
        </aside>

        <section className={styles.workbench} aria-label="Free AI brand check">
          <div className={styles.fileShadow} aria-hidden="true" />
          <div className={styles.checkFile}>
            <div className={styles.fileTab}>NEW CASE / FREE CHECK</div>
            <div className={styles.formHeader}>
              <div>
                <p>Evidence request</p>
                <h2>Run your free check</h2>
              </div>
              <span>No signup</span>
            </div>
            <form
              className={styles.formBody}
              data-app-health-event="free_check.started"
              onSubmit={(event) => {
                event.preventDefault();
                void runCheck();
              }}
            >
              <label htmlFor="brand-domain">Canonical product domain</label>
              <div className={styles.inputRow}>
                <input
                  id="brand-domain"
                  type="text"
                  inputMode="url"
                  autoComplete="url"
                  placeholder="yourproduct.com or https://yourproduct.com"
                  value={domain}
                  onChange={(event) => setDomain(event.target.value)}
                  disabled={loading || !clientReady}
                />
                <button type="submit" disabled={loading || !domain.trim()}>
                  {loading ? <Loader2 aria-hidden="true" /> : <Search aria-hidden="true" />}
                  <span>{loading ? "Checking" : "Run check"}</span>
                </button>
              </div>
              <p>Limited to three free checks per hour to protect the public endpoint.</p>
            </form>
          </div>

          {error && (
            <div className={styles.errorSheet} role="alert">
              <span>Check incomplete</span>
              <p>{error}</p>
            </div>
          )}

          {loading && (
            <div className={styles.loadingSheet} aria-live="polite">
              <Loader2 aria-hidden="true" />
              <div>
                <strong>Building the evidence record for {brandName || domain}</strong>
                <p>Reading the site, generating questions, and preserving the response. Usually about a minute; we stop after three minutes so you can retry.</p>
              </div>
              <span className={styles.loadingRule} aria-hidden="true" />
            </div>
          )}

          {mentionPercent !== null && (
            <div className={styles.results} aria-live="polite">
              <section className={styles.resultSummary} aria-label="AI mention result">
                <div className={styles.scoreBox}>
                  <span>Observed mention rate</span>
                  <strong>{mentionPercent}%</strong>
                </div>
                <div className={styles.resultCopy}>
                  <p>Case result</p>
                  <h2>{brandName}</h2>
                  <span className={styles.resultStamp}>{mentionStatus}</span>
                  <small>Calculated from successful checks only.</small>
                </div>
              </section>

              <section className={styles.evidenceResults}>
                <header>
                  <div>
                    <p>Evidence register</p>
                    <h2>Answers by question</h2>
                  </div>
                  <span>{results.length} records</span>
                </header>
                <div className={styles.resultList}>
                  {results.map((result, index) => {
                    const panelId = `answer-evidence-${index}`;
                    const isExpanded = expandedIdx === index;
                    return (
                      <article key={`${result.prompt}-${index}`} className={styles.resultItem}>
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          aria-controls={panelId}
                          onClick={() => setExpandedIdx(isExpanded ? null : index)}
                        >
                          <span className={result.brand_mentioned ? styles.mentioned : styles.notMentioned}>
                            {result.brand_mentioned ? <CircleCheckBig aria-hidden="true" /> : <X aria-hidden="true" />}
                          </span>
                          <span className={styles.provider}>{result.platform}</span>
                          <span className={styles.prompt}>{result.prompt}</span>
                          <span className={styles.position}>{result.brand_position ? `#${result.brand_position}` : isExpanded ? "Close" : "Open"}</span>
                        </button>
                        {isExpanded && (
                          <div id={panelId} className={styles.answerDetail}>
                            <div>
                              <span>Model</span>
                              <strong>{result.model}</strong>
                            </div>
                            <div>
                              <span>Citation state</span>
                              <strong>{result.brand_cited ? "Brand cited" : "No brand citation"}</strong>
                            </div>
                            <p>{result.response_preview}</p>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>

              <section className={styles.workspaceCta}>
                <div>
                  <p>Keep the case open</p>
                  <h2>Track the same evidence over time.</h2>
                  <span>Create a workspace for history, competitors, tasks, and recurring checks.</span>
                </div>
                <Link href="/dashboard">Open a workspace <span aria-hidden="true">→</span></Link>
              </section>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
