"use client";

import { useEffect, useState } from "react";
import { FeedbackWidget } from "@saas-maker/feedback";
import "@saas-maker/feedback/dist/index.css";

const API_BASE = "https://api.sassmaker.com";
const CATALOG_ID = "mentionpilot";

export function SaaSMakerFeedback() {
  const [isDesktop, setIsDesktop] = useState(false);
  const [projectKey, setProjectKey] = useState("");

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 640px)");
    const sync = () => setIsDesktop(mediaQuery.matches);

    sync();
    mediaQuery.addEventListener("change", sync);

    return () => mediaQuery.removeEventListener("change", sync);
  }, []);

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

  if (!projectKey || !isDesktop) return null;
  return (
    <FeedbackWidget
      projectId={projectKey}
      apiBaseUrl={API_BASE}
      position="bottom-right"
      theme="dark"
    />
  );
}
