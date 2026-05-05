import { loadConfig } from "@/core/config";
import type { CheckResult } from "../run";
export async function checkEngine(): Promise<CheckResult> {
  const cfg = loadConfig();
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.query_timeout_seconds * 1000);
  try {
    const resp = await fetch(cfg.skill_query_url.replace(/\/$/, "") + "/retrieve", {
      method: "POST", signal: ctrl.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "doctor-probe" }),
    });
    const ms = Date.now() - t0;
    if (resp.ok || resp.status === 404) {
      return { name: "engine reachable", status: "pass", detail: `${cfg.skill_query_url}, ${ms}ms` };
    }
    return { name: "engine reachable", status: "fail", detail: `HTTP ${resp.status}` };
  } catch (e) {
    return { name: "engine reachable", status: "fail", detail: (e as Error).message };
  } finally { clearTimeout(timer); }
}
