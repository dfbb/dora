import type { CheckResult } from "../run";
export async function checkNode(): Promise<CheckResult> {
  const major = parseInt(process.versions.node.split(".")[0]!, 10);
  return { name: "Node 18+", status: major >= 18 ? "pass" : "fail", detail: `v${process.versions.node}` };
}
