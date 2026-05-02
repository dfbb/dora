import { DoraError, ERR } from "./errors";
import { appendQueryLog } from "./log";

export interface SkillCandidate {
  name: string;
  url?: string;
  description_en?: string;
  github_stars?: number;
  security_level?: "safe" | "warn" | "danger" | "unknown";
  [k: string]: unknown;
}

export interface QueryOpts {
  url: string;
  mode: string;
  topK: number;
  timeoutMs: number;
}

export interface QueryResult {
  skills: SkillCandidate[];
}

export async function queryEngine(query: string, opts: QueryOpts): Promise<QueryResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs);
  let resp: Response;
  try {
    resp = await fetch(opts.url.replace(/\/$/, "") + "/retrieve", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, mode: opts.mode, top_k: opts.topK }),
    });
  } catch (e) {
    throw new DoraError(ERR.ENGINE_UNREACHABLE, `connect failed: ${(e as Error).message}`, { url: opts.url });
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    const body = await resp.text();
    throw new DoraError(ERR.HTTP_ERROR, `HTTP ${resp.status}: ${body.slice(0, 200)}`, { status: resp.status });
  }

  const json = (await resp.json()) as QueryResult;
  if (!json.skills || json.skills.length === 0) {
    appendQueryLog({ query, candidate_count: 0 });
    throw new DoraError(ERR.EMPTY_CANDIDATES, "no matching skill", { query });
  }
  appendQueryLog({ query, candidate_count: json.skills.length });
  return json;
}
