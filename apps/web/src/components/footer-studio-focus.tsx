"use client";

import { useEffect } from "react";

export function FooterStudioFocus() {
  useEffect(() => {
    const host = document.querySelector('fleet-footer-extension[data-fleet-footer-project="mentionpilot"]');
    if (!host) return;
    let active = true;
    let root: ShadowRoot | null = null;
    const revealFocus = (event: Event) => {
      const link = event.target;
      if (!(link instanceof HTMLAnchorElement) || root?.host.getAttribute("layout") !== "studio") return;
      const viewport = link.closest<HTMLElement>('[role="region"]');
      if (!viewport) return;
      const bounds = viewport.getBoundingClientRect();
      const focused = link.getBoundingClientRect();
      if (focused.right > bounds.right - 8) {
        viewport.scrollLeft += focused.right - bounds.right + 8;
      } else if (focused.left < bounds.left + 8) {
        viewport.scrollLeft -= bounds.left - focused.left + 8;
      }
    };
    const observer = new MutationObserver(bind);
    function bind() {
      if (!active || root) return;
      root = host?.querySelector("portfolio-project-strip")?.shadowRoot ?? null;
      if (!root) return;
      // Intra-component focus is retargeted outside the open shadow root.
      root.addEventListener("focusin", revealFocus);
      observer.disconnect();
    }
    observer.observe(host, { childList: true, subtree: true });
    void customElements.whenDefined("portfolio-project-strip").then(bind);
    return () => {
      active = false;
      observer.disconnect();
      root?.removeEventListener("focusin", revealFocus);
    };
  }, []);
  return null;
}
