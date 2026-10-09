# Sample readiness brief: PostTrainLLM

**Observation date:** 2026-10-02  
**Status:** Public-source readiness example only. **This is not a completed AI visibility report.**  
**AI provider observations:** Not collected. No assistant answers, prompts, citations, or model outcomes are claimed here.  
**Subject:** PostTrainLLM, a public product owned by the MentionPilot owner; see [the project dossier](../../../../site-health/docs/project-dossiers/posttrainllm.yaml) for its canonical identity and documented public domain.

## Decision question

Can a founder quickly understand what PostTrainLLM does, who it is for, what proof is publicly available, and what its limits are—and what public-page change would make that understanding easier to verify?

This brief audits the publicly reachable product sources. It can prepare a future monitoring run by identifying claims and questions worth testing. It cannot tell us whether ChatGPT, Claude, Gemini, Perplexity, or any other assistant currently mentions or cites PostTrainLLM.

## Public observations

| Page checked on 2026-10-02 | Direct observation | What the source supports |
| --- | --- | --- |
| [PostTrainLLM README](https://github.com/PostTrainLLM/posttrainllm/blob/main/README.md) | Describes a Mac-first local LLM factory and browser playground; separates CLI, Mac app, research/eval, and browser surfaces; names limitations such as no enterprise platform and no Linux/CUDA path. | A technically specific product identity, public implementation surfaces, evidence and limitations are available in the README. This is the repository's own description, not independent validation. |
| [Quickstart documentation](https://posttrainllm.com/docs/quickstart/) | Documents `posttrainllm quickstart`, accepted dataset shapes, on-device processing, expected adapter/project outputs, a dry-run option, and explicit V1 limitations. | A buyer/practitioner can inspect a concrete path and its boundaries before trying it. These are documentation claims; this brief did not run the command. |
| [Recipe index](https://posttrainllm.com/recipes) | Organizes recipes by problem/failure mode, with validation states such as “validated with caveat,” “reference only,” and closed experiments. | The public teaching surface presents recipes with evidence status and caveats rather than treating every experiment as a win. This is an editorial observation, not independent validation of each recipe. |

These pages were read on 2026-10-02. Page content and model behavior can change; this is a dated snapshot, not a claim about later states.

## Public-source readout

**Clear strength:** The most credible material is concrete and bounded: a named workflow, accepted input shapes, generated artifacts, a dry-run, and visible limits. That supports a practical explanation of the tool better than a broad claim about “AI training.”

**Observed destination mismatch:** The checkout README labels its top link “Live browser playground” but points to the homepage. Public GET checks on 2026-10-02 show that the homepage introduces the Mac-local specialist factory, while `/playground` is the separate page titled “Playground.” Both returned HTTP 200. This is a concrete link-label mismatch; this brief has no visitor observations proving that it causes confusion.

**Suggested low-cost action:** Point the README's “Live browser playground” link directly to `https://posttrainllm.com/playground`, or rename the existing homepage link to match its destination. Preserve the existing recipe, learning-path, and Mac quickstart links. This is a proposed copy/link correction, not an implemented change or proven conversion improvement. It also makes the intended browser entry point unambiguous for a future answer-and-citation review.

## Proposed buyer questions for a future collection

These are test prompts, not prompts already sent to an AI assistant:

1. “I have a small JSONL dataset and an Apple Silicon Mac. What tool can help me fine-tune a small specialist model locally, and what does the workflow produce?”
2. “How can I experiment with training a language model in the browser, and what are the practical limits?”
3. “What is PostTrainLLM, who is it for, and how is it different from a hosted model API?”
4. “Which PostTrainLLM quickstart limitations should I check before relying on it for a project?”
5. “What public evidence does PostTrainLLM provide for its specialist-model results, and what should I not infer from those results?”

No answers or citation sources are supplied for these questions. They need to be run against an identified, authorized endpoint and retained with the complete prompt, response, provider status, model, time, and any returned URLs before the result can be called an AI visibility finding.

## Example evidence record shape

For each actually collected observation, MentionPilot's result contract supports: `prompt_text`, `platform`, `model`, `provider_status`, `error_message`, `response_text`, `brand_mentioned`, `brand_sentiment`, `brand_position`, `competitors_mentioned`, `citations`, `brand_cited`, `latency_ms`, and `created_at` (`packages/shared/src/index.ts`, `ResultRecord`). These fields describe the product's local result shape; this example contains no populated AI result record.

The public free-check flow does not provide the same evidence record: it persists only a 500-character response preview and derived flags, with no retained citation list or per-prompt failure detail in the stored result. The generated report also omits full response text and citation URLs. A future paid brief must use retrievable signed-in records or a disclosed manual capture process, then verify the exported source record before analysis.

## Sources

- PostTrainLLM project identity and product boundaries: [README](https://github.com/PostTrainLLM/posttrainllm/blob/main/README.md), checked 2026-10-02.
- Specific local workflow and current quickstart caveats: [Quickstart](https://posttrainllm.com/docs/quickstart/), checked 2026-10-02.
- Evidence-status labels and recipe organization: [Recipes](https://posttrainllm.com/recipes), checked 2026-10-02.
- Link-destination checks: [Homepage](https://posttrainllm.com/) and [Playground](https://posttrainllm.com/playground), public GET/title checks performed by the root agent on 2026-10-02. Neither interactive workflow was exercised by those requests.
- Canonical owner-local domain and classification: `site-health/docs/project-dossiers/posttrainllm.yaml`, observed 2026-10-02. The dossier records `https://posttrainllm.com` as the project's primary URL.
