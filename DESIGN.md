---
name: Signal Room
status: selected
mode: replacement
surface: landing-and-workspace
colors:
  paper: "#F2EEE5"
  paper_deep: "#E7E0D3"
  ink: "#171613"
  ink_soft: "#625E56"
  signal: "#E84F3F"
  signal_dark: "#A92E24"
  rule: "#C9C0B1"
  night: "#191815"
  night_soft: "#CFC7BA"
typography:
  display: "Iowan Old Style, Palatino Linotype, Book Antiqua, Georgia, serif"
  body: "var(--font-geist-sans), Arial, sans-serif"
  evidence: "var(--font-geist-mono), SFMono-Regular, Consolas, monospace"
radius:
  small: "6px"
  medium: "12px"
  paper: "2px"
spacing:
  page: "clamp(1.25rem, 4vw, 4rem)"
  section: "clamp(5rem, 10vw, 9rem)"
---

# Overview

Signal Room presents MentionPilot as an editorial investigation into how AI assistants describe a brand. The page uses a warm paper field, black ink, coral audit marks, source receipts, ruled evidence sheets, and a dark closing register. It should feel composed by an analyst, not assembled from SaaS cards.

## Direction contract

**Thesis:** AI visibility is useful only when the answer behind it remains inspectable. **Own-world:** a working signal room of evidence sheets, source receipts, marginal audit marks, and linked next actions. **Story:** see the question, compare the observed answers, locate the narrative gap, improve the source material, and check again. **First viewport:** a restrained promise, clear audience and action, plus one credible evidence record that demonstrates the product rather than claiming scale. **Form:** editorial composition with strong rules, paper layers, compact labels, and one signal-red annotation system. The hero must stay calm: no oversized three-line spectacle, gradient type, floating blobs, or metric strip.

# Colors

- Paper is the default canvas; paper-deep creates section changes without introducing a second visual world.
- Ink is used for primary text and structural rules. Ink-soft is for supporting copy and remains accessible on paper.
- Signal red is reserved for observed mentions, annotations, check marks, and primary actions. Signal-dark is used when red carries small text.
- Night appears once, in the closing section, to create a decisive ending rather than a site-wide dark theme.
- Do not introduce decorative gradients, neon accents, or rainbow provider colours.

# Typography

- Display type uses the serif stack for concise headlines and pull statements. Keep the hero below `clamp(3rem, 6vw, 5.4rem)` and no tighter than `-0.04em` tracking.
- Body copy uses Geist Sans with comfortable line length and direct language.
- Evidence labels, prompt IDs, timestamps, and source receipts use Geist Mono sparingly.
- Sentence case is the default. Uppercase is reserved for short document labels.

# Layout

- Desktop content uses a maximum width near 1240px with asymmetrical editorial columns.
- Sections are separated by rules, shifts in paper tone, or document edges rather than card grids.
- The first viewport pairs a measured narrative column with a dominant evidence sheet.
- On small screens, evidence layers flatten into a single readable column; no horizontal overflow is allowed.

# Elevation & Depth

- Depth comes from offset paper layers, subtle hard shadows, pins, folds, and overlapping evidence—not blur or glassmorphism.
- Shadows are neutral and restrained. Important evidence may lift by 2–4px on hover.
- The dark close is flat and typographic.

# Shapes

- Rules, underlines, brackets, stamps, clipped notes, and document corners are the primary shapes.
- Corners are mostly square or lightly rounded. Pill shapes are limited to status stamps.
- Icons are supporting notation, never the main visual motif.

# Components

- **Evidence sheet:** question, provider/source, answer excerpt, mention state, citations, and observed time.
- **Audit mark:** signal-red underline, bracket, circle, or short marginal note tied to specific evidence.
- **Source receipt:** compact mono metadata proving where and when a record came from.
- **Action docket:** a finding paired with one concrete next action and its attached evidence.
- **Primary action:** solid signal-red rectangle with clear verb; the secondary action is an ink text link.

# Do's and Don'ts

- Do show real product mechanics with clearly labelled illustrative content when live evidence is unavailable.
- Do keep provider failures and coverage limits explicit.
- Do use written annotations to explain why a detail matters.
- Do make the free check the strongest public action.
- Don't invent customer logos, benchmarks, testimonials, or provider results.
- Don't fall back to generic icon cards, hero metric strips, glowing dashboards, glass panels, or oversized slogans.
- Don't let the editorial styling reduce readability, keyboard access, or responsive clarity.

## Workspace continuity

The landing and dashboard share Signal Room: the product mark and wordmark, warm paper, ink, coral actions, serif findings, sans controls, mono evidence labels, and ruled sections. The workspace uses denser spacing and a persistent project rail because it supports repeat use. Mobile navigation uses a native disclosure and project selector. The authenticated owner selects an owned project before any project-bound page opens. Switching remounts the page so evidence and drafts stay within their case file.

Monitoring controls distinguish saved state, unsaved drafts, unavailable state, and failed saves. Recurrence requires a saved brand profile and prompts, plus either the existing free-ai service or a complete custom endpoint/model/API key setup. The managed source is labelled free-ai; its returned model is evidence, not proof of consumer-assistant coverage. Alerts remain explicitly unavailable. No illustrative answer on the public landing establishes a live provider result or a successful scheduled run.
