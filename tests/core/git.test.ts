import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, cpSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { gitClone, gitLsRemoteHead, gitRevParse } from "@/core/git";
import { DoraError } from "@/core/errors";

let work: string;
let fixtureRepo: string;

function makeFixtureRepo(parent: string): string {
  const dst = join(parent, "fixture-src");
  cpSync("tests/fixtures/sample-skill-repo", dst, { recursive: true });
  execSync("git init -q && git add . && git -c user.email=t@d -c user.name=t commit -q -m init", { cwd: dst });
  return dst;
}

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), "dora-git-"));
  fixtureRepo = makeFixtureRepo(work);
});
afterEach(() => rmSync(work, { recursive: true, force: true }));

describe("git wrappers", () => {
  it("gitClone produces a working tree", () => {
    const dst = join(work, "out");
    gitClone(`file://${fixtureRepo}`, dst);
    expect(existsSync(join(dst, "SKILL.md"))).toBe(true);
  });
  it("gitClone throws DoraError(CLONE_FAILED) on bad URL", () => {
    expect(() => gitClone("file:///does/not/exist", join(work, "x"))).toThrow(DoraError);
  });
  it("gitLsRemoteHead returns a sha", () => {
    const sha = gitLsRemoteHead(`file://${fixtureRepo}`);
    expect(sha).toMatch(/^[0-9a-f]{40}$/);
  });
  it("gitRevParse HEAD returns a sha", () => {
    expect(gitRevParse(fixtureRepo, "HEAD")).toMatch(/^[0-9a-f]{40}$/);
  });
});
