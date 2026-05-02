import { execFileSync } from "node:child_process";
import { DoraError, ERR } from "./errors";

export function gitClone(repoUrl: string, dst: string): void {
  try {
    execFileSync("git", ["clone", "--depth=1", "--single-branch", "--no-tags", repoUrl, dst], {
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    const stderr = (e as { stderr?: Buffer }).stderr?.toString() ?? "";
    throw new DoraError(ERR.CLONE_FAILED, `git clone failed: ${stderr.slice(0, 200)}`, { repoUrl });
  }
}

export function gitLsRemoteHead(repoUrl: string): string {
  try {
    const out = execFileSync("git", ["ls-remote", repoUrl, "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const sha = out.split(/\s+/)[0];
    if (!sha || !/^[0-9a-f]{40}$/.test(sha)) {
      throw new DoraError(ERR.CLONE_FAILED, "ls-remote returned no sha", { repoUrl });
    }
    return sha;
  } catch (e) {
    if (e instanceof DoraError) throw e;
    throw new DoraError(ERR.CLONE_FAILED, `ls-remote failed: ${(e as Error).message}`, { repoUrl });
  }
}

export function gitRevParse(cwd: string, ref: string): string {
  const out = execFileSync("git", ["rev-parse", ref], { cwd, encoding: "utf8" });
  return out.trim();
}

export function gitFetchReset(cwd: string): void {
  execFileSync("git", ["fetch", "--depth=1", "origin"], { cwd, stdio: ["ignore", "pipe", "pipe"] });
  execFileSync("git", ["reset", "--hard", "FETCH_HEAD"], { cwd, stdio: ["ignore", "pipe", "pipe"] });
}
