# Live qualification correction — 2026-10-02

The report-download receipt and the initial progress update described five retained MentionPilot answers based on the completed 5/5 history counter. Inspection of the actual downloaded owner report showed that this counter records attempts. Correct qualification is five retained result records: two successful answers and three explicit managed-gateway HTTP 502 errors. The original receipt is retained as history; this correction supersedes its five-answer handoff claim.

Actual owner-authenticated report downloads were generated and parsed for all three pilot projects:

| Brand | Attempts | Successful answers | Explicit gateway errors | Mention rate among successful answers |
| --- | ---: | ---: | ---: | ---: |
| MentionPilot | 5 | 2 | 3 | 0% |
| StorageDaddy | 5 | 4 | 1 | 0% |
| PostTrainLLM | 5 | 5 | 0 | 0% |

All successful records identify source `free-ai` and returned model `gemini-3.5-flash-lite`. Error records identify source `free-ai`, model `unknown`, empty answer and explicit `Managed AI gateway error (502)`. These unavailable responses are excluded from the mention-rate denominator. All fifteen result records were exported; this is eleven answers and four errors, not fifteen successful answers. Citation arrays and complete retained answer text were present. No real report containing owner identifiers was committed.

MentionPilot alone has a daily canary schedule saved and verified after reload. First due run is 2026-10-03 at 06:00 UTC; no actual scheduled execution is claimed. StorageDaddy and PostTrainLLM recurrence remain off. This provisional enrollment is not qualification for portfolio-wide recurrence or a paid reliability promise. No new provider requests were made to retry failed evidence during this review.

The public first-value check in the parent review had three displayed result records; only the first expanded answer and its returned model were directly inspected. Do not interpret that parent review as independently verified success of all three records.
