import { accessSync, constants, mkdirSync } from "node:fs";
import { resolveDoraHome } from "@/core/paths";
import type { CheckResult } from "../run";
export async function checkHome(): Promise<CheckResult> {
  const p = resolveDoraHome();
  try {
    mkdirSync(p, { recursive: true });
    accessSync(p, constants.W_OK);
    return { name: "DORA_HOME writable", status: "pass", detail: p };
  } catch (e) {
    return { name: "DORA_HOME writable", status: "fail", detail: `${p}: ${(e as Error).message}` };
  }
}
