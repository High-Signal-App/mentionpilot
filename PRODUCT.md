# MentionPilot product context

## Product

MentionPilot is an evidence-first brand intelligence workspace for founders and marketing teams. It shows how configured AI assistants describe a brand, how that narrative compares with competitors, and which source or positioning gaps deserve action.

## Core user journey

1. Define a brand, competitors, topics, and relevant keywords.
2. Run or schedule AI visibility checks and ingest supported social signals.
3. Inspect the original prompt, response, citations, provider status, and observation time.
4. Review a prioritised signal inbox and competitor-perception evidence.
5. Create a follow-up task, dismiss or resolve a finding, and revisit its history.

## Product promise

MentionPilot makes AI visibility explainable. It keeps the evidence behind the result and connects that evidence to the next useful action instead of reducing the work to an opaque score.

## Current truth and boundaries

- AI checks retain provider attribution, prompts, responses, citations, timestamps, and explicit errors.
- Failed or unavailable provider calls are not counted as negative mentions.
- Evidence-readiness audits are deterministic heuristics and must be labelled as such.
- Hacker News and the bounded Reddit Insights archive are supported social inputs; F5Bot and Google Trends remain planned.
- MentionPilot owns brand-specific interpretation and action, not bulk Reddit collection, general news publishing, or automatic public replies.
- Owned projects share one workspace selector. Project-bound evidence and drafts reset when switching.
- Saved brand profiles without custom endpoint settings use the existing free-ai service for manual and scheduled checks. Returned model identity, answers, citations and failures remain inspectable; this does not measure consumer-assistant coverage. Partial custom setups must be completed; working BYOK setups keep their direct endpoint.
- Schedules are explicitly saved as off, daily or weekly. Daily attempts run at 06:00 UTC; weekly attempts run on Monday. Email and Slack alerts are unavailable.
- The public free check is the primary acquisition action; the signed-in workspace is the ongoing product.
- No customer counts, performance benchmarks, pricing, or provider-availability claims may be invented.

## Audience and tone

The primary audience is a product-aware founder or marketing lead who distrusts vanity metrics and wants to see the underlying answer. The product should feel incisive, editorial, and credible: closer to a well-organised research desk than a generic analytics dashboard.

## Success

A user can configure a brand, receive a relevant finding, inspect its evidence, take an action, and revisit the history. Product metrics should focus on useful-finding rate, actionable findings, resolution, repeat use, and source freshness; targets remain TBD until a real-use baseline exists.

The AI Mentions results page downloads the latest project evidence report as JSON through the existing owner-authenticated report API. The export retains complete answers, source/model identity, citations, explicit errors and recent history; selecting an older check does not change the latest-report export.
