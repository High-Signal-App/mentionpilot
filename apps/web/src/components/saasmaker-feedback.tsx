"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { FeedbackWidget } from "@saas-maker/feedback";
import "@saas-maker/feedback/dist/index.css";
import styles from "./saasmaker-feedback.module.css";

const API_BASE = "https://api.sassmaker.com";
const CATALOG_ID = "mentionpilot";

export function SaaSMakerFeedback() {
  const [projectKey, setProjectKey] = useState("");
  const isWorkspace = usePathname().startsWith("/dashboard");

  useEffect(() => {
    let active = true;

    fetch(`${API_BASE}/v1/capture-config/${CATALOG_ID}`)
      .then((response) => {
        if (!response.ok) throw new Error("Feedback config is unavailable.");
        return response.json() as Promise<{ api_key?: unknown }>;
      })
      .then((config) => {
        if (active && typeof config.api_key === "string" && config.api_key.startsWith("pk_")) {
          setProjectKey(config.api_key);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  if (!projectKey) return null;
  return (
    <footer
      className={`${styles.support} ${isWorkspace ? styles.workspace : ""}`}
      aria-labelledby="feedback-heading"
    >
      <div className={styles.section}>
        <div>
          <h2 id="feedback-heading">Help shape MentionPilot.</h2>
          <p>Have a question or an idea? Send us feedback.</p>
        </div>
        <FeedbackWidget
          projectId={projectKey}
          apiBaseUrl={API_BASE}
          position="bottom-right"
          theme="dark"
          triggerText="Send feedback"
        />
      </div>
    </footer>
  );
}
