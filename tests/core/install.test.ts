import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, symlinkSync, readFileSync, existsSync } from "node:fs";
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isSafeCacheKey, copyTreeNoSymlinks, SYMLINK_REJECTED, installSkill } from "@/core/install";
import * as statusMod from "@/core/status";
import { writeStatus, loadStatus } from "@/core/status";
import type { Status } from "@/core/types";

describe("isSafeCacheKey", () => {
  it("accepts normal keys including long ones over 64 chars", () => {
    expect(isSafeCacheKey("foo_alice")).toBe(true);
    expect(isSafeCacheKey("chart-visualization_bytedance")).toBe(true);
    expect(isSafeCacheKey("a".repeat(64) + "_" + "b".repeat(20))).toBe(true); // > 64
    expect(isSafeCacheKey("with.dots_and-dashes")).toBe(true);
  });

  it("accepts single-segment names containing a .. substring", () => {
    expect(isSafeCacheKey("foo_..")).toBe(true);
    expect(isSafeCacheKey("a..b_owner")).toBe(true);
  });

  it("rejects path separators and absolute paths", () => {
    expect(isSafeCacheKey("foo/bar")).toBe(false);
    expect(isSafeCacheKey("/abs")).toBe(false);
    expect(isSafeCacheKey("a\\b")).toBe(false);
  });

  it("rejects empty and the dot segments", () => {
    expect(isSafeCacheKey("")).toBe(false);
    expect(isSafeCacheKey(".")).toBe(false);
    expect(isSafeCacheKey("..")).toBe(false);
  });

  it("rejects null/undefined at runtime", () => {
    expect(isSafeCacheKey(null as unknown as string)).toBe(false);
    expect(isSafeCacheKey(undefined as unknown as string)).toBe(false);
  });
});

describe("copyTreeNoSymlinks", () => {
  let src: string;
  let dst: string;
  beforeEach(() => {
    src = mkdtempSync(join(tmpdir(), "dora-src-"));
    dst = mkdtempSync(join(tmpdir(), "dora-dst-"));
    rmSync(dst, { recursive: true, force: true }); // copy target must not pre-exist
  });
  afterEach(() => {
    rmSync(src, { recursive: true, force: true });
    rmSync(dst, { recursive: true, force: true });
  });

  it("copies files, subdirs, and dotfiles; returns file count", () => {
    writeFileSync(join(src, "SKILL.md"), "# s");
    writeFileSync(join(src, ".hidden"), "secret");
    mkdirSync(join(src, "sub"));
    writeFileSync(join(src, "sub", "a.txt"), "a");
    const n = copyTreeNoSymlinks(src, dst);
    expect(n).toBe(3);
    expect(readFileSync(join(dst, "SKILL.md"), "utf8")).toBe("# s");
    expect(readFileSync(join(dst, ".hidden"), "utf8")).toBe("secret");
    expect(readFileSync(join(dst, "sub", "a.txt"), "utf8")).toBe("a");
  });

  it("throws SYMLINK_REJECTED when a file symlink is present", () => {
    writeFileSync(join(src, "SKILL.md"), "# s");
    symlinkSync("/etc/passwd", join(src, "evil"));
    expect(() => copyTreeNoSymlinks(src, dst)).toThrow(SYMLINK_REJECTED);
  });

  it("throws SYMLINK_REJECTED for a symlink nested in a subdir", () => {
    mkdirSync(join(src, "sub"));
    symlinkSync("../../shared", join(src, "sub", "assets"));
    expect(() => copyTreeNoSymlinks(src, dst)).toThrow(SYMLINK_REJECTED);
  });

  it("throws SYMLINK_REJECTED for a symlinked directory at top level", () => {
    writeFileSync(join(src, "SKILL.md"), "# s");
    mkdirSync(join(src, "real"));
    symlinkSync(join(src, "real"), join(src, "link-dir"));
    expect(() => copyTreeNoSymlinks(src, dst)).toThrow(SYMLINK_REJECTED);
  });
});

describe("installSkill", () => {
  let cacheHome: string; // DORA_HOME
  let platHome: string;  // injected platform home
  const orig = { ...process.env };

  const writeCachedSkill = (key: string, primaryRel: string, files: Record<string, string>) => {
    const root = join(cacheHome, "skills", key);
    for (const [rel, content] of Object.entries(files)) {
      const abs = join(root, rel);
      mkdirSync(join(abs, ".."), { recursive: true });
      writeFileSync(abs, content);
    }
    const status: Status = {
      version: 1,
      skills: {
        [key]: {
          skill_name: key.split("_")[0]!, owner: key.split("_")[1] ?? "o",
          repo_url: `https://github.com/o/${key.split("_")[0]}`,
          github_hash: "h", primary_skill_path: primaryRel,
          security_level: "safe",
          downloaded_at: "2026-05-01T00:00:00Z",
          last_used_at: "2026-05-01T00:00:00Z",
          use_count: 0,
        },
      },
    };
    writeStatus(status);
  };

  beforeEach(() => {
    cacheHome = mkdtempSync(join(tmpdir(), "dora-cacheh-"));
    platHome = mkdtempSync(join(tmpdir(), "dora-plath-"));
    process.env.DORA_HOME = cacheHome;
  });
  afterEach(() => {
    process.env = { ...orig };
    rmSync(cacheHome, { recursive: true, force: true });
    rmSync(platHome, { recursive: true, force: true });
  });

  it("extracts a deeply nested SKILL.md to the platform top level and removes cache", () => {
    writeCachedSkill("foo_alice", "skills/public/foo/SKILL.md", {
      "skills/public/foo/SKILL.md": "# foo",
      "skills/public/foo/helper.md": "h",
    });
    const r = installSkill({ name: "foo_alice", platform: "codex" }, platHome);
    expect(r.ok).toBe(true);
    expect(existsSync(join(platHome, ".codex/skills/foo/SKILL.md"))).toBe(true);
    expect(existsSync(join(platHome, ".codex/skills/foo/helper.md"))).toBe(true);
    expect(r.cache_removed).toBe(true);
    expect(existsSync(join(cacheHome, "skills", "foo_alice"))).toBe(false);
  });

  it("resolves by bare skill_name when unique", () => {
    writeCachedSkill("foo_alice", "SKILL.md", { "SKILL.md": "# foo" });
    const r = installSkill({ name: "foo", platform: "claude-code" }, platHome);
    expect(r.ok).toBe(true);
    expect(existsSync(join(platHome, ".claude/skills/foo/SKILL.md"))).toBe(true);
  });

  it("returns not_cached for an unknown name", () => {
    writeStatus({ version: 1, skills: {} });
    const r = installSkill({ name: "ghost", platform: "codex" }, platHome);
    expect(r.error).toBe("not_cached");
  });

  it("returns platform_unknown for an unmapped platform", () => {
    writeCachedSkill("foo_alice", "SKILL.md", { "SKILL.md": "# foo" });
    const r = installSkill({ name: "foo_alice", platform: "unknown" }, platHome);
    expect(r.error).toBe("platform_unknown");
  });

  it("skips when target already exists, touching neither dir nor cache", () => {
    writeCachedSkill("foo_alice", "SKILL.md", { "SKILL.md": "# foo" });
    mkdirSync(join(platHome, ".codex/skills/foo"), { recursive: true });
    writeFileSync(join(platHome, ".codex/skills/foo/SKILL.md"), "OLD");
    const r = installSkill({ name: "foo_alice", platform: "codex" }, platHome);
    expect(r.skipped).toBe(true);
    expect(readFileSync(join(platHome, ".codex/skills/foo/SKILL.md"), "utf8")).toBe("OLD");
    expect(existsSync(join(cacheHome, "skills", "foo_alice"))).toBe(true); // cache untouched
  });
});

describe("installSkill security & recovery", () => {
  let cacheHome: string;
  let platHome: string;
  const orig = { ...process.env };
  beforeEach(() => {
    cacheHome = mkdtempSync(join(tmpdir(), "dora-sec-c-"));
    platHome = mkdtempSync(join(tmpdir(), "dora-sec-p-"));
    process.env.DORA_HOME = cacheHome;
  });
  afterEach(() => {
    process.env = { ...orig };
    rmSync(cacheHome, { recursive: true, force: true });
    rmSync(platHome, { recursive: true, force: true });
  });

  const seed = (key: string, primaryRel: string, files: Record<string, string>) => {
    const root = join(cacheHome, "skills", key);
    for (const [rel, content] of Object.entries(files)) {
      const abs = join(root, rel);
      mkdirSync(join(abs, ".."), { recursive: true });
      writeFileSync(abs, content);
    }
    // owner is hardcoded; no test in this suite asserts on it (simplified from writeCachedSkill)
    writeStatus({
      version: 1,
      skills: { [key]: {
        skill_name: key.split("_")[0]!, owner: "o",
        repo_url: "https://github.com/o/x", github_hash: "h",
        primary_skill_path: primaryRel, security_level: "safe",
        downloaded_at: "2026-05-01T00:00:00Z", last_used_at: "2026-05-01T00:00:00Z", use_count: 0,
      } },
    });
  };

  it("rejects primary_skill_path that escapes the cache (../../)", () => {
    seed("foo_alice", "../../evil/SKILL.md", { "SKILL.md": "# real" });
    mkdirSync(join(cacheHome, "evil"), { recursive: true });
    writeFileSync(join(cacheHome, "evil", "SKILL.md"), "# evil");
    const r = installSkill({ name: "foo_alice", platform: "codex" }, platHome);
    expect(r.error).toBe("invalid_skill_path");
    expect(existsSync(join(cacheHome, "skills", "foo_alice"))).toBe(true); // cache untouched
  });

  it("rejects when SKILL.md itself is a symlink", () => {
    const root = join(cacheHome, "skills", "foo_alice");
    mkdirSync(root, { recursive: true });
    writeFileSync(join(cacheHome, "outside.md"), "x");
    symlinkSync(join(cacheHome, "outside.md"), join(root, "SKILL.md"));
    writeStatus({ version: 1, skills: { foo_alice: {
      skill_name: "foo", owner: "alice", repo_url: "https://github.com/alice/foo",
      github_hash: "h", primary_skill_path: "SKILL.md", security_level: "safe",
      downloaded_at: "2026-05-01T00:00:00Z", last_used_at: "2026-05-01T00:00:00Z", use_count: 0,
    } } });
    const r = installSkill({ name: "foo_alice", platform: "codex" }, platHome);
    expect(r.error).toBe("invalid_skill_path");
    expect(existsSync(join(platHome, ".codex/skills/foo"))).toBe(false);
  });

  it("rejects a symlink inside the skill dir (cache-internal but out of srcDir)", () => {
    seed("foo_alice", "skills/foo/SKILL.md", { "skills/foo/SKILL.md": "# foo" });
    mkdirSync(join(cacheHome, "skills", "foo_alice", "shared"), { recursive: true });
    symlinkSync("../../shared", join(cacheHome, "skills", "foo_alice", "skills", "foo", "assets"));
    const r = installSkill({ name: "foo_alice", platform: "codex" }, platHome);
    expect(r.error).toBe("invalid_skill_path");
    expect(existsSync(join(platHome, ".codex/skills/foo"))).toBe(false); // nothing landed
  });

  it("rejects skill_name with path separators (invalid_skill_name)", () => {
    seed("bad_alice", "SKILL.md", { "SKILL.md": "# x" });
    // poison skill_name post-seed
    const status = statusMod.loadStatus();
    status.skills["bad_alice"]!.skill_name = "../escape";
    statusMod.writeStatus(status);
    const r = installSkill({ name: "bad_alice", platform: "codex" }, platHome);
    expect(r.error).toBe("invalid_skill_name");
  });

  it("returns cache_removed:false when cache rmSync fails but install succeeds", () => {
    // chmod-based deletion blocking is a no-op for root; skip there to avoid a false failure.
    if (typeof process.getuid === "function" && process.getuid() === 0) return;
    seed("foo_alice", "SKILL.md", { "SKILL.md": "# foo" });
    // Make the cache key dir non-deletable: remove write permission on the dir itself
    // so rmSync({recursive}) can't remove the child file inside it.
    const cacheKeyDir = join(cacheHome, "skills", "foo_alice");
    fs.chmodSync(cacheKeyDir, 0o555);
    try {
      const r = installSkill({ name: "foo_alice", platform: "codex" }, platHome);
      expect(r.ok).toBe(true);
      expect(r.cache_removed).toBe(false);
      expect(r.cache_cleanup_error).toBeDefined();
      expect(existsSync(join(platHome, ".codex/skills/foo/SKILL.md"))).toBe(true);
    } finally {
      fs.chmodSync(cacheKeyDir, 0o755); // restore so afterEach cleanup works
    }
  });

  it("rolls back the installed targetDir when writeStatus fails", () => {
    seed("foo_alice", "SKILL.md", { "SKILL.md": "# foo" });
    const spy = vi.spyOn(statusMod, "writeStatus").mockImplementationOnce(() => { throw new Error("disk full"); });
    expect(() => installSkill({ name: "foo_alice", platform: "codex" }, platHome)).toThrow("disk full");
    expect(existsSync(join(platHome, ".codex/skills/foo"))).toBe(false); // rolled back
    expect(existsSync(join(cacheHome, "skills", "foo_alice"))).toBe(true); // cache preserved
    spy.mockRestore();
  });
});
