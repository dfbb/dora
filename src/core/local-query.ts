import type { SkillCandidate, QueryResult } from "./query";
import { DoraError, ERR } from "./errors";

export type LocalQueryResult = QueryResult & { source: "local" };

export async function localQuery(_query: string, _topK: number): Promise<LocalQueryResult> {
  throw new DoraError(ERR.LOCAL_INDEX_BROKEN, "not implemented", { reason: "stub" });
}

export function __resetLocalIndexForTest(): void {
  // populated in Task 7
}
