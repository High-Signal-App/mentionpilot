# MentionPilot evidence-to-action pilot

**Prepared:** 2026-10-02  
**Status:** Local offer hypothesis for review; not published and not current product pricing.  
**Canonical product boundary:** [MentionPilot PRODUCT.md](../../../PRODUCT.md)

## Recommendation

Test a founder-led B2B SaaS offer as a fixed-scope, paid **AI visibility evidence-to-action pilot**. Sell a bounded decision and a repeatable monitoring setup, rather than a promise to improve rankings or make a brand appear in AI answers.

**Price hypothesis:** **US$750 once** for the first pilot. This is a test price, not existing MentionPilot pricing. There is no customer interview, willingness-to-pay, or market benchmark behind it yet. The pilot should establish whether one founder will pay for evidence tied to a concrete content or positioning decision. If the work cannot be delivered inside the cost assumptions below, do not accept this price unchanged.

## Offer copy (draft)

### See how an AI model describes your product—and choose what to clarify next.

MentionPilot turns a small, repeatable set of buyer questions into an evidence trail: the prompt, identified AI endpoint and model, response, citation URLs when present, and the time checked. We review what the answers say about your product, compare the result with up to two alternatives, and hand back a short action brief grounded in the observed answers and your public pages.

The 10-business-day pilot covers one B2B SaaS brand, up to five agreed buyer questions, one actually available and identified AI endpoint, and two observation rounds. You receive the source record, a prioritized action brief, and a proposed 30-day monitoring cadence. Provider failures stay visible as failures; they are never treated as evidence that an endpoint did not mention you.

**Proposed pilot fee: US$750 fixed.** A one-time research and setup fee; no subscription is included or implied. We confirm endpoint access and evidence retention before accepting payment. The fee and scope are a pilot hypothesis and may change after the first real buyer conversation.

**Draft CTA:** `Request a scoped pilot`

### What you receive

- One brand, its public website, and up to two named competitors.
- Up to five buyer-intent questions, agreed before collection and held constant across two rounds.
- Two dated collection rounds from one named endpoint/model that is actually available for this pilot. The report names the endpoint/model and collection time; it does not generalize one model's output to all assistants.
- A compact evidence ledger with prompt, full response for every successful observation, provider status, model, timestamp, citation URLs when returned, and deterministic mention flags. Unavailable responses are marked as errors. Human interpretation is labeled as analysis, not a provider fact.
- A short brief with the observed answer patterns, source-page strengths or gaps, up to three prioritized changes, and one suggested next monitoring interval.
- A 30-minute readout, scheduled within the 10-business-day delivery window.

### Exclusions

No guarantee of inclusion, ranking, traffic, leads, revenue, or change in assistant answers. No SEO implementation, content writing, site changes, citation acquisition, paid media, competitor impersonation, bulk social listening, automatic public replies, ongoing subscription, or multi-provider coverage unless separately scoped after evidence of product support. A failed or unavailable endpoint produces an explicit gap and a revised delivery decision; it does not count as a negative result.

## Who should buy

**Working ICP hypothesis:** a founder or first marketing hire at a small B2B SaaS company that already has a public product site and is deciding what to clarify on its core product, use-case, or comparison pages. The buyer has noticed that prospects ask AI tools for recommendations, or wants to understand how their category is described, but distrusts a single opaque visibility score. This is a hypothesis derived from the product purpose and intended audience in `PRODUCT.md`; it is not validated customer research.

This is a poor fit for a company seeking guaranteed placement, a broad market-share benchmark, enterprise procurement or an SLA, or a statistically representative measure of all users and all AI products.

## Buyer intake (before a quote is accepted)

1. Company/product name and canonical public URL.
2. Your role and who will approve the pilot and fee.
3. What decision should the report help you make in the next 30 days?
4. Which one product/use case should the prompts represent?
5. Up to two alternatives buyers actually compare you with; mark any that are assumptions.
6. Up to five questions a buyer might ask an assistant before choosing this type of product.
7. Which public pages should be treated as the current source of truth?
8. Which AI endpoint/model do you want observed, if any? Can you authorize and fund its use? Availability and evidence capture must be checked before acceptance.
9. Any restrictions on prompts, competitor names, retention, or sharing the resulting report?
10. Preferred kickoff window and readout attendees.

Do not request credentials in this intake form. If an endpoint requires a customer credential, arrange a safe, approved configuration path before the paid work begins.

## Delivery and operating assumptions

| Item | Pilot assumption |
| --- | --- |
| Duration | 10 business days from confirmed scope, usable public URLs, and a working authorized endpoint |
| Collection | Two rounds, up to five prompts per round, one named endpoint/model; same prompts in both rounds |
| Human time | Up to 6 hours: intake/scope (1 h), source and prompt review (1 h), two collection/evidence passes (2 h), synthesis (1 h), readout and handoff (1 h) |
| Price | US$750 one-time hypothesis |
| Direct cost model | Planning allowance: up to US$50 endpoint/usage cost plus approximately US$25 payment/administrative cost; verify actual vendor and payment fees before quoting. No paid provider calls are authorized by this draft. |
| Internal time value | Planning assumption of US$75/hour × 6 hours = US$450 |
| Contribution before tax/overhead | Approximately US$225 at the assumptions above (US$750 − US$450 − US$50 − US$25). This is a planning estimate, not measured margin. |
| Overrun rule | Stop and rescope if endpoint setup, retries, evidence recovery, or analysis pushes past six hours or US$50 usage. Never hide provider failures to meet the estimate. |

The two rounds are for a directional, within-pilot comparison, not a controlled experiment or stable ranking. Model versions, retrieval, answer variability, and provider configuration can change. Record these when exposed; do not claim that a change in answers was caused by a site edit unless the design supports that conclusion.

## Product readiness gate before taking money

The product's data model supports useful evidence: `ResultRecord` carries prompt text, platform, model, `provider_status`, error message, response text, extracted citation URLs, and `created_at` (`packages/shared/src/index.ts`). `workers/api/src/lib/ai-engine.ts` sends one configured OpenAI-compatible endpoint and extracts URLs from the returned text; this is not proof of native search-grounded citations or separate access to four assistants.

The public free-check route (`workers/api/src/routes/free-check.ts`) currently stores a 500-character `response_preview`, platform/model and mention flags, but drops the explicit citation list and per-prompt error from the stored result. The report generator (`workers/api/src/routes/reports.ts`) returns selected mention fields but omits full responses and citations. Therefore a paid evidence report must not be delivered from the free-check summary or generated report alone. Before accepting payment, verify one of these paths end to end: (a) a signed-in run where full result records can be retrieved and manually exported into the evidence ledger, or (b) a clearly disclosed manual collection process with source capture and timestamps. Confirm the actual endpoint/model, its authorization and cost, and that a reviewer can inspect the complete evidence. If these gates fail, defer payment and fix the delivery path first.

This is a narrow delivery blocker, not a feature roadmap: without full source records and a reliable capture path, the central paid promise (evidence behind the recommendation) cannot be fulfilled. The current report API also has no report history (`GET /:projectId/reports` returns a placeholder), so promise a manually delivered brief, not durable in-product report history.

## Claims and evidence boundary

| Proposed claim | Support | Boundary |
| --- | --- | --- |
| MentionPilot retains provider attribution, prompts, responses, citation URLs, timestamps, and explicit errors for signed-in results. | `ResultRecord` type and AI engine implementation. | Schema/code capability only; paid delivery still needs a verified retrieval/export path. |
| MentionPilot makes AI visibility explainable and ties evidence to a useful next action. | Current product promise in `PRODUCT.md`; pilot copy turns it into a bounded service. | Product intent, not an independently measured customer outcome. |
| The pilot observes what one named endpoint/model returned on two dated runs. | Proposed fixed collection protocol. | Depends on availability and retained evidence; not all assistants, users, or future answers. |
| The pilot will improve AI visibility, traffic, or revenue. | No supporting evidence. | Do not claim or imply this. |

## What would validate this offer

Before treating the price or buyer as established, have a real qualified founder confirm the decision they would pay to make, accept the exact one-endpoint scope, and agree to the proposed fee. A paid booking is stronger evidence than interest; repeat monitoring must be separately requested and paid before it is described as recurring revenue.
