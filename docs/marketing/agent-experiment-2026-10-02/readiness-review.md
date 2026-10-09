# First commercial experiment: readiness review

Prepared 2026-10-02. Local drafts only. No campaign launched, payment accepted,
outreach sent, paid inference requested, or production change made.

## Decision

Use the MentionPilot pilot to test a direct purchasing reason. Use the existing
PostTrainLLM lesson to test whether an educational artifact can attract useful
attention. These are separate experiments: video views do not establish demand
for MentionPilot, and a MentionPilot sale does not establish an advertising
business.

The first sales unit should be a bounded, manually reviewed brief. Automating
recurring delivery is justified after buyers find the initial brief useful and
want a subsequent comparison. Prices in the offer are hypotheses, not current
product pricing or validated willingness to pay.

## Current evidence

Public GET requests on 2026-10-02 returned HTTP 200 for:

- https://mention.highsignal.app/check — the form offers a live model check and
  visible questions and response excerpts. No check was submitted in this run.
- https://posttrainllm.com/articles/how-to-cook-an-llm — the lesson distinguishes
  its tiny WASM training path from authored SFT/preference illustrations. Its
  article canonical matches the route. Interactive execution and recording
  were not verified in this run.

The browser research tool could not retrieve these pages; an ordinary public
HTTP GET succeeded. Reachability is not proof of core-workflow completion.

Repository inspection:

- `workers/api/src/routes/free-check.ts` retains a 500-character response
  preview, prompt, platform/model, and mention/citation flags. It does not
  retain the full response or citation URL list in the public result; failed
  prompt calls are filtered out. A successful aggregate score therefore is
  insufficient evidence for a complete paid report.
- `workers/api/src/lib/ai-engine.ts` retains full response text, prompt,
  platform/model, citation URLs, and explicit error records in the signed-in
  check path. Actual successful live execution of that path was not verified
  here. It uses the configured endpoint; do not promise consumer-app coverage
  or named providers that have not actually been observed.
- `PRODUCT.md` names provider attribution, original evidence, errors, and
  evidence-linked actions as the product contract. `PRD.md` leaves pricing and
  provider coverage TBD.
- A narrow search of current web/API/database source found no purchase or
  billing integration. This is not a payment-account audit. No checkout or
  payment destination has been configured or verified by this experiment.

## Minimum before accepting a pilot payment

1. Produce one complete owned-brand brief from genuine captured observations:
   exact prompts, full answers, provider/model, observation times, citation
   URLs, explicit missing/error observations, and linked source snapshots or
   dated source references. Use the signed-in path or a clearly documented
   manual capture. A source-readiness sample alone is not this proof.
2. Review every recommendation against those observations. Report observed
   differences and testable page changes without claiming to know why a model
   chose a citation or promising an increase in visibility.
3. Verify the buyer intake, delivery format, available payment method, agreed
   scope, and how an undeliverable order will be handled. Keep the provider
   coverage and human review visible in the offer.
4. Time the delivery and record actual inference/operating cost. Set a firm
   scope before selling. A hypothetical price does not establish margin.

## First-cycle learning

Use the existing measurement and discovery workflow; this document does not
create a new portfolio tracker. For each authorized placement, retain its live
URL, campaign link, dates, qualified arrivals, relevant conversations, accepted
orders, delivery time, refunds, and received payments separately.

After the initial two-week distribution cycle:

- Little relevant exposure means the distribution attempt is inconclusive.
- Relevant arrivals without meaningful engagement call for examining the
  artifact and message.
- Engagement without orders calls for examining the offer and buying reason.
- Received payments with useful delivered work and manageable costs justify
  another bounded cycle.

Two weeks cannot establish recurring retention, organic-search potential, or a
sustainable ad business. No outcome has been measured yet.
