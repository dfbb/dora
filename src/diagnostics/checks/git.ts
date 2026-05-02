import { execFileSync } from "node:child_process";
import type { CheckResult } from "../run";
export async function checkGit(): Promise<CheckResult> {
  try {
    const out = execFileSync("git", ["--version"], { encoding: "utf8" });
    return { name: "git available", status: "pass", detail: out.trim().replace(/^git version /, "") };
  } catch {
    return { name: "git available", status: "fail", detail: "not installed" };
  }
}
