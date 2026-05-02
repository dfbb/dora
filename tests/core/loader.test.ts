import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { loadSkill } from "@/core/loader";
import { loadStatus, writeStatus } from "@/core/status";
import { DoraError, ERR } from "@/core/errors";

let work: string;
let fixtureUrl: string;
const orig = { ...process.env };

function makeRepo(parent: string, kind: "ok" | "no-skill" | "nested"): string {
  const dst = join(parent, `src-${kind}`);
  mkdirSync(dst, { recursive: true });
  if (kind === "ok") writeFileSync(join(dst, "SKILL.md"), "# ok\n");
  if (kind === "no-skill") writeFileSync(join(dst, "README.md"), "no");
  if (kind === "nested") {
    mkdirSync(join(dst, "sub", "sample"), { recursive: true });
    writeFileSync(join(dst, "sub", "sample", "SKILL.md"), "# nested\n");
  }
  execSync("git init -q && git add . && git -c user.email=t@d -c user.name=t commit -q -m init", { cwd: dst });
  return `file://${dst}`;
}

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), "dora-loader-"));
  process.env.DORA_HOME = work;
  process.env.DORA_TEST = "1";
});
afterEach(() => {
  process.env = { ...orig };
  rmSync(work, { recursive: true, force: true });
});

describe("loadSkill", () => {
  it("clones, locates SKILL.md, writes status, returns cache_hit=false", async () => {
    fixtureUrl = makeRepo(work, "ok");
    const r = await loadSkill({ name: "sample", repoUrl: fixtureUrl, securityLevel: "safe" });
    expect(r.cache_hit).toBe(false);
    expect(r.key).toBe("sample_local");
    expect(existsSync(r.skill_md_path)).toBe(true);
    const status = loadStatus();
    expect(status.skills["sample_local"]!.security_level).toBe("safe");
    expect(status.skills["sample_local"]!.use_count).toBe(0);
  });

  it("cache hits when entry within TTL", async () => {
    fixtureUrl = makeRepo(work, "ok");
    await loadSkill({ name: "sample", repoUrl: fixtureUrl, securityLevel: "safe" });
    const r = await loadSkill({ name: "sample", repoUrl: fixtureUrl, securityLevel: "safe" });
    expect(r.cache_hit).toBe(true);
  });

  it("re-clones on TTL expiry", async () => {
    fixtureUrl = makeRepo(work, "ok");
    await loadSkill({ name: "sample", repoUrl: fixtureUrl, securityLevel: "safe" });
    const status = loadStatus();
    status.skills["sample_local"]!.last_used_at = new Date(Date.now() - 30 * 86_400_000).toISOString();
    writeStatus(status);
    writeFileSync(join(work, "config.yaml"), "cache_ttl_days: 1\n");
    const r = await loadSkill({ name: "sample", repoUrl: fixtureUrl, securityLevel: "safe" });
    expect(r.cache_hit).toBe(false);
  });

  it("throws NO_SKILL_MD when repo has no SKILL.md", async () => {
    fixtureUrl = makeRepo(work, "no-skill");
    await expect(loadSkill({ name: "sample", repoUrl: fixtureUrl, securityLevel: "safe" }))
      .rejects.toMatchObject({ code: ERR.NO_SKILL_MD });
    expect(existsSync(join(work, "skills", "sample_local"))).toBe(false);
  });

  it("prefers <name>/SKILL.md when nested", async () => {
    fixtureUrl = makeRepo(work, "nested");
    const r = await loadSkill({ name: "sample", repoUrl: fixtureUrl, securityLevel: "warn" });
    expect(r.skill_md_path.endsWith("/sub/sample/SKILL.md")).toBe(true);
  });

  it("rejects non-github URL when DORA_TEST not set", async () => {
    process.env.DORA_TEST = "";
    fixtureUrl = makeRepo(work, "ok");
    await expect(loadSkill({ name: "sample", repoUrl: fixtureUrl, securityLevel: "safe" }))
      .rejects.toMatchObject({ code: ERR.VALIDATION });
  });
});
