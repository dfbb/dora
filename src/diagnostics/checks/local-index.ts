import type { CheckResult } from "../run";
import { isDoraError } from "@/core/errors";
import { localQuery } from "@/core/local-query";

export async function checkLocalIndex(): Promise<CheckResult> {
  try {
    await localQuery("smoke", 1);
    return { name: "local index", status: "pass" };
  } catch (e) {
    if (isDoraError(e)) {
      if (e.code === "empty_candidates") {
        return { name: "local index", status: "pass" };
      }
      const reason = (e.detail as { reason?: string } | undefined)?.reason;
      return { name: "local index", status: "fail", detail: reason ?? e.code };
    }
    return { name: "local index", status: "fail", detail: (e as Error).message };
  }
}
