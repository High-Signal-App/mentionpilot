import type { CheckRecord, ResultRecord } from "@mentionpilot/shared";

export interface VisibilityScore {
  checkId: string | null;
  score: number;
  grade: string;
  breakdown: { mention: number; sentiment: number; position: number; citation: number; reach: number };
  max: VisibilityScore["breakdown"];
}

export type VisibilityCheck = Pick<CheckRecord, "id" | "status" | "total_queries" | "completed_queries"> & {
  results: Pick<ResultRecord, "provider_status">[];
};

export function getVisibilityEvidence(score: VisibilityScore | null, check: VisibilityCheck | null): {
  status: "unknown" | "partial" | "complete";
  message: string;
} {
  const successful = check?.results?.filter(result => result?.provider_status === "success").length ?? 0;
  if (!score || !["A", "B", "C", "D", "F"].includes(score.grade) ||
      !Number.isFinite(score.score) || !Object.values(score.breakdown).every(Number.isFinite) ||
      !score.checkId || check?.id !== score.checkId ||
      check?.status !== "completed" || successful === 0 || !(check.total_queries > 0)) {
    return { status: "unknown", message: "Run a successful AI check to measure visibility. Failed or unavailable responses are not negative mentions." };
  }
  const complete = successful === check.total_queries &&
    check.completed_queries === check.total_queries && check.results.length === check.total_queries;
  return {
    status: complete ? "complete" : "partial",
    message: `${successful}/${check.total_queries} successful responses in the latest check.${complete ? "" : " Score uses available responses only; coverage is incomplete."}`,
  };
}
