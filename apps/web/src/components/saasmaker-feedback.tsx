"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { FeedbackWidget } from "@saas-maker/feedback";
import "@saas-maker/feedback/dist/index.css";
import styles from "./saasmaker-feedback.module.css";

const API_BASE = "https://api.sassmaker.com";
const CATALOG_ID = "mentionpilot";

export function SaaSMakerFeedback({ embedded = false }: { embedded?: boolean } = {}) {
  const [projectKey, setProjectKey] = useState("");
  const supportRef = useRef<HTMLElement>(null);
  const pathname = usePathname();
  const isWorkspace = pathname.startsWith("/dashboard");
  const shouldShow = embedded || pathname !== "/";

  useEffect(() => {
    if (!shouldShow) return;
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
  }, [shouldShow]);

  useEffect(() => {
    const support = supportRef.current;
    if (!support) return;
    let dialogOpen = false;
    const observer = new MutationObserver(() => {
      const dialog = support.querySelector<HTMLElement>('[role="dialog"]');
      const open = Boolean(dialog);
      if (open && !dialogOpen) dialog?.querySelector<HTMLInputElement>("input")?.focus();
      // The published widget removes its dialog without restoring the opener.
      // Preserve intentional focus elsewhere; recover only focus lost to BODY.
      if (dialogOpen && !open && document.activeElement === document.body) {
        support.querySelector<HTMLButtonElement>("[data-saasmaker-widget] > button")?.focus();
      }
      dialogOpen = open;
    });
    const keepDialogFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const dialog = support.querySelector<HTMLElement>('[role="dialog"]');
      if (!dialog) return;
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>("button, input, textarea, select, a[href], [tabindex]"))
        .filter((control) => control.tabIndex >= 0 && !control.matches(":disabled") && control.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    observer.observe(support, { childList: true, subtree: true });
    support.addEventListener("keydown", keepDialogFocus);
    return () => {
      observer.disconnect();
      support.removeEventListener("keydown", keepDialogFocus);
    };
  }, [projectKey, shouldShow]);

  if (!projectKey || !shouldShow) return null;
  return (
    <footer
      ref={supportRef}
      slot={embedded ? "feedback" : undefined}
      className={`${styles.support} ${isWorkspace ? styles.workspace : ""} ${embedded ? styles.embedded : ""}`}
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
