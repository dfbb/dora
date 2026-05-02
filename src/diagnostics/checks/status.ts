import { ensureConsistent } from "@/core/status";
import { listSkills } from "@/core/cache";
import type { CheckResult } from "../run";
export async function checkStatus(): Promise<CheckResult> {
  try {
    const s = ensureConsistent();
    const rows = listSkills();
    const total = Object.keys(s.skills).length;
    const orphans = rows.filter((r) => r.status === "orphan").length;
    const broken = rows.filter((r) => r.status === "broken").length;
    return {
      name: "status.yaml consistent",
      status: broken > 0 ? "warn" : "pass",
      detail: `${total} skills, ${orphans} orphan, ${broken} broken`,
    };
  } catch (e) {
    return { name: "status.yaml consistent", status: "fail", detail: (e as Error).message };
  }
}
