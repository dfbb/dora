import { loadConfig } from "@/core/config";
import type { CheckResult } from "../run";
export async function checkConfig(): Promise<CheckResult> {
  try { loadConfig(); return { name: "config.yaml valid", status: "pass" }; }
  catch (e) { return { name: "config.yaml valid", status: "fail", detail: (e as Error).message }; }
}
