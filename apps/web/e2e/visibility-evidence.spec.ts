import { test, expect } from "@playwright/test";
import { getVisibilityEvidence, type VisibilityCheck, type VisibilityScore } from "../src/lib/visibility-evidence";

const zero: VisibilityScore = {
  checkId: "check-1",
  score: 0, grade: "F",
  breakdown: { mention: 0, sentiment: 0, position: 0, citation: 0, reach: 0 },
  max: { mention: 30, sentiment: 20, position: 20, citation: 15, reach: 15 },
};
const complete: VisibilityCheck = {
  id: "check-1",
  status: "completed", total_queries: 2, completed_queries: 2,
  results: [{ provider_status: "success" }, { provider_status: "success" }],
};

test("no checks and N/A zero are unknown", () => {
  expect(getVisibilityEvidence({ ...zero, grade: "N/A" }, null).status).toBe("unknown");
  expect(getVisibilityEvidence({ ...zero, grade: "N/A" }, complete).status).toBe("unknown");
});

test("measured zero remains a complete measurement", () => {
  expect(getVisibilityEvidence(zero, complete)).toEqual({ status: "complete", message: "2/2 successful responses in the latest check." });
});

test("partial provider evidence cannot imply complete coverage", () => {
  const result = getVisibilityEvidence(zero, { ...complete, results: [{ provider_status: "success" }, { provider_status: "error" }] });
  expect(result.status).toBe("partial");
  expect(result.message).toContain("1/2 successful responses");
  expect(result.message).toContain("coverage is incomplete");
});

test("missing result records or unfinished query counts are partial", () => {
  expect(getVisibilityEvidence(zero, { ...complete, results: [{ provider_status: "success" }] }).status).toBe("partial");
  expect(getVisibilityEvidence(zero, { ...complete, completed_queries: 1 }).status).toBe("partial");
});

test("failed checks, all failed responses and running checks are unknown even with an old score", () => {
  expect(getVisibilityEvidence(zero, { ...complete, status: "failed" }).status).toBe("unknown");
  expect(getVisibilityEvidence(zero, { ...complete, status: "running" }).status).toBe("unknown");
  expect(getVisibilityEvidence(zero, { ...complete, results: [{ provider_status: "error" }, { provider_status: "error" }] }).status).toBe("unknown");
});

test("unavailable score or evidence is unknown", () => {
  expect(getVisibilityEvidence(null, complete).status).toBe("unknown");
  expect(getVisibilityEvidence(zero, null).status).toBe("unknown");
});

test("score evidence must come from the same check, including overlapping request completion", () => {
  const oldScore = { ...zero, checkId: "check-1", score: 80, grade: "A" };
  const newerCheck = { ...complete, id: "check-2" };
  expect(getVisibilityEvidence(oldScore, newerCheck).status).toBe("unknown");
  expect(getVisibilityEvidence({ ...oldScore, checkId: null }, complete).status).toBe("unknown");
});

test("complete positive evidence retains its measured score", () => {
  const score = { ...zero, score: 100, grade: "A", breakdown: zero.max };
  expect(getVisibilityEvidence(score, complete).status).toBe("complete");
});

test("a completed check without results is unknown", () => {
  expect(getVisibilityEvidence(zero, { ...complete, results: [] }).status).toBe("unknown");
});

test("invalid scores or zero planned queries cannot establish a measurement", () => {
  expect(getVisibilityEvidence({ ...zero, score: NaN }, complete).status).toBe("unknown");
  expect(getVisibilityEvidence(zero, { ...complete, total_queries: 0 }).status).toBe("unknown");
});
