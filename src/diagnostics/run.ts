import { checkNode } from "./checks/node";
import { checkGit } from "./checks/git";
import { checkHome } from "./checks/home";
import { checkConfig } from "./checks/config";
import { checkEngine } from "./checks/engine";
import { checkStatus } from "./checks/status";
import { checkPlatform } from "./checks/platform";

export type CheckStatus = "pass" | "fail" | "warn";
export interface CheckResult {
  name: string;
  status: CheckStatus;
  detail?: string;
}

export async function runChecks(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  results.push(await checkNode());
  results.push(await checkGit());
  results.push(await checkHome());
  results.push(await checkConfig());
  results.push(await checkEngine());
  results.push(await checkStatus());
  const plat = await checkPlatform();
  results.push(plat.mcp);
  results.push(plat.hook);
  return results;
}

export function renderChecklist(results: CheckResult[]): string {
  const lines = ["## dora doctor", ""];
  for (const r of results) {
    const glyph = r.status === "pass" ? "[x]" : r.status === "fail" ? "[ ]" : "[-]";
    const detail = r.detail ? ` (${r.detail})` : "";
    lines.push(`- ${glyph} ${r.name}${detail}`);
  }
  return lines.join("\n");
}

export async function runDoctor(): Promise<string> {
  return renderChecklist(await runChecks());
}
