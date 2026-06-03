# dora-install 命令实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `/dora:dora-install <skill> [platform]` 命令,把 dora 缓存里的 skill 移动到当前平台的系统 skills 目录,移动中修正目录层次让 SKILL.md 落在顶层。

**Architecture:** 新增纯函数 resolver(`src/platforms/skills-dir.ts`)做平台→目录映射;核心搬运逻辑在 `src/core/install.ts`(返回判别式结果对象,意外错误抛出);MCP handler(`src/mcp/tools.ts`)负责平台解析与 home 注入;`skills/dora-install/SKILL.md` 是用户命令入口,只调工具+展示。

**Tech Stack:** TypeScript + Node fs/path + Zod(MCP schema)+ Vitest(测试)+ esbuild(bundle)。

---

## File Structure

- Create: `src/platforms/skills-dir.ts` — `PLATFORM_SKILLS_SUBDIR` 映射 + `resolvePlatformSkillsDir(platform, home)`。
- Create: `src/core/install.ts` — `isSafeCacheKey`、`copyTreeNoSymlinks`(内部)、`installSkill`。
- Modify: `src/mcp/tools.ts` — `PlatformContext` 加 `platformSkillsHome?`、`InstallSchema`、`dora_install` handler、`toolDefs` 新增条目。
- Create: `skills/dora-install/SKILL.md` — 用户命令。
- Create: `tests/platforms/skills-dir.test.ts` — resolver 单测。
- Create: `tests/core/install.test.ts` — installSkill 全分支测试。
- Modify: `tests/mcp/tools.test.ts` — dora_install handler 平台解析测试。
- Modify: `README.md` + `README.zh.md` `README.ja.md` `README.kr.md` `README.fr.md` `README.es.md` `README.de.md` — 命令表加一行。
- Modify: `package.json`、`.claude-plugin/plugin.json`、`.claude-plugin/marketplace.json` — 版本 0.1.19 → 0.1.20。

---

## Task 1: 平台 skills 目录 resolver

**Files:**
- Create: `src/platforms/skills-dir.ts`
- Test: `tests/platforms/skills-dir.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/platforms/skills-dir.test.ts
import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { resolvePlatformSkillsDir, PLATFORM_SKILLS_SUBDIR } from "@/platforms/skills-dir";

describe("resolvePlatformSkillsDir", () => {
  it("maps each known platform to <home>/<subdir>", () => {
    const home = "/tmp/fakehome";
    expect(resolvePlatformSkillsDir("claude-code", home)).toBe(join(home, ".claude/skills"));
    expect(resolvePlatformSkillsDir("codex", home)).toBe(join(home, ".codex/skills"));
    expect(resolvePlatformSkillsDir("opencode", home)).toBe(join(home, ".config/opencode/skills"));
    expect(resolvePlatformSkillsDir("gemini-cli", home)).toBe(join(home, ".gemini/skills"));
    expect(resolvePlatformSkillsDir("qwen-code", home)).toBe(join(home, ".qwen/skills"));
  });

  it("returns null for unknown / unmapped platform", () => {
    expect(resolvePlatformSkillsDir("unknown", "/tmp/h")).toBeNull();
    expect(resolvePlatformSkillsDir("nonsense", "/tmp/h")).toBeNull();
  });

  it("defaults home to homedir() when omitted", () => {
    const r = resolvePlatformSkillsDir("codex");
    expect(r).toMatch(/\.codex[/\\]skills$/);
  });

  it("exposes a subdir for all five platforms", () => {
    expect(Object.keys(PLATFORM_SKILLS_SUBDIR).sort()).toEqual(
      ["claude-code", "codex", "gemini-cli", "opencode", "qwen-code"]
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/platforms/skills-dir.test.ts`
Expected: FAIL — cannot find module `@/platforms/skills-dir`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/platforms/skills-dir.ts
import { homedir } from "node:os";
import { join } from "node:path";

export const PLATFORM_SKILLS_SUBDIR: Record<string, string> = {
  "claude-code": ".claude/skills",
  codex: ".codex/skills",
  opencode: ".config/opencode/skills",
  "gemini-cli": ".gemini/skills",
  "qwen-code": ".qwen/skills",
};

export function resolvePlatformSkillsDir(platform: string, home: string = homedir()): string | null {
  const sub = PLATFORM_SKILLS_SUBDIR[platform];
  if (!sub) return null;
  return join(home, sub);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/platforms/skills-dir.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/platforms/skills-dir.ts tests/platforms/skills-dir.test.ts
git commit -m "feat(install): add platform skills-dir resolver"
```

## Task 2: `isSafeCacheKey` 校验器

`key` 来自 `status.yaml`(不可信)。不能复用 `validateName()`(64 长度上限会误拒 `<skillName>_<owner>`,且其正则允许 `..`)。规则:非空、不含路径分隔符、非绝对路径、整段不等于 `.` 或 `..`;含 `..` 子串的单段名(如 `foo_..`)允许。

**Files:**
- Create: `src/core/install.ts`(本任务先只放此函数)
- Test: `tests/core/install.test.ts`(本任务先只测此函数)

- [ ] **Step 1: Write the failing test**

```typescript
// tests/core/install.test.ts
import { describe, expect, it } from "vitest";
import { isSafeCacheKey } from "@/core/install";

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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/install.test.ts`
Expected: FAIL — cannot find module `@/core/install` / `isSafeCacheKey` not exported.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/core/install.ts
import { isAbsolute } from "node:path";

export function isSafeCacheKey(key: string): boolean {
  if (!key) return false;
  if (key === "." || key === "..") return false;
  if (isAbsolute(key)) return false;
  if (key.includes("/") || key.includes("\\")) return false;
  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/install.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/install.ts tests/core/install.test.ts
git commit -m "feat(install): add isSafeCacheKey validator"
```

## Task 3: `copyTreeNoSymlinks` 递归拷贝助手

结构化遍历(不用 glob,含 dotfiles),拒绝整棵子树里的任何 symlink。命中 symlink 时抛出哨兵错误 `SYMLINK_REJECTED`(供 `installSkill` 转成 `invalid_skill_path`);成功返回拷贝的文件数。

**Files:**
- Modify: `src/core/install.ts`(追加 `SYMLINK_REJECTED` 与 `copyTreeNoSymlinks`)
- Test: `tests/core/install.test.ts`(追加一个 describe 块)

- [ ] **Step 1: Write the failing test**

```typescript
// tests/core/install.test.ts — append these imports at top of file
import { beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, symlinkSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copyTreeNoSymlinks, SYMLINK_REJECTED } from "@/core/install";

// append this describe block
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/install.test.ts`
Expected: FAIL — `copyTreeNoSymlinks` / `SYMLINK_REJECTED` not exported.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/core/install.ts — add imports and append.
// NOTE: import node:fs as a namespace (`import * as fs`) NOT named imports.
// Reason: Tasks 4-5 inject failures via `vi.spyOn(fs, "rmSync")`. A spy reliably
// intercepts only when the call goes through the namespace object at call-time;
// named imports capture the binding at import-time and the spy won't see them.
import * as fs from "node:fs";
import { isAbsolute, join } from "node:path";

export const SYMLINK_REJECTED = "SYMLINK_REJECTED";

// Recursively copy src into dst. Rejects ANY symlink in the subtree
// (throws Error(SYMLINK_REJECTED)). Includes dotfiles. Returns file count.
export function copyTreeNoSymlinks(src: string, dst: string): number {
  fs.mkdirSync(dst, { recursive: true });
  let count = 0;
  for (const dirent of fs.readdirSync(src, { withFileTypes: true })) {
    const from = join(src, dirent.name);
    const to = join(dst, dirent.name);
    if (dirent.isSymbolicLink()) {
      throw new Error(SYMLINK_REJECTED);
    }
    if (dirent.isDirectory()) {
      count += copyTreeNoSymlinks(from, to);
    } else if (dirent.isFile()) {
      fs.copyFileSync(from, to);
      count += 1;
    }
    // sockets/fifos/etc. are skipped silently
  }
  return count;
}
```

Note: `isSafeCacheKey` (Task 2) imports `isAbsolute` from `node:path`; merge it into the single `import { isAbsolute, join } from "node:path"` line above.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/install.test.ts`
Expected: PASS (isSafeCacheKey + copyTreeNoSymlinks groups).

- [ ] **Step 5: Commit**

```bash
git add src/core/install.ts tests/core/install.test.ts
git commit -m "feat(install): add symlink-rejecting recursive copy helper"
```

## Task 4: `installSkill` 核心搬运

把前三个任务的助手组装成完整的 move 逻辑。返回判别式结果对象;意外错误(拷贝失败、writeStatus 失败)抛出由 handler 包成 internal。

**Files:**
- Modify: `src/core/install.ts`(追加 `InstallInput`/`InstallResult` 类型与 `installSkill`)
- Test: `tests/core/install.test.ts`(追加 `installSkill` describe 块)

- [ ] **Step 1: Write the failing test**

```typescript
// tests/core/install.test.ts — append. Reuses imports from Tasks 2-3.
// Add: import { installSkill } from "@/core/install";
//      import { writeStatus } from "@/core/status";
//      import { existsSync } from "node:fs";
//      import type { Status } from "@/core/types";

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/install.test.ts`
Expected: FAIL — `installSkill` not exported.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/core/install.ts — merge imports, then append.
// fs is already imported as a namespace from Task 3 (`import * as fs from "node:fs"`).
// status is imported as a namespace too, so Task 5 can spy on writeStatus:
import * as statusMod from "./status";
import { isAbsolute, join, dirname, resolve, sep } from "node:path";
import { skillsDir } from "./paths";
import { validateName } from "./validate";
import type { SkillEntry } from "./types";

export interface InstallInput { name: string; platform: string; }

// Flat result shape (not a discriminated union): every field optional so tests
// can read r.ok / r.error / r.skipped without TS narrowing errors (tests are in
// tsconfig `include` under strict mode). It is JSON-serialized verbatim by the
// MCP handler, so a flat bag of optional fields is exactly what the consumer wants.
export type InstallErrorCode =
  | "not_cached" | "ambiguous" | "platform_unknown" | "invalid_skill_path" | "invalid_skill_name";

export interface InstallResult {
  ok?: true;
  skipped?: true;
  reason?: "exists";
  error?: InstallErrorCode;
  candidates?: string[];
  skill_name?: string;
  platform?: string;
  source_path?: string;
  target_path?: string;
  file_count?: number;
  cache_removed?: boolean;
  cache_cleanup_error?: string;
}

// resolve name -> { key, entry }; or an InstallResult error if not unique
function resolveEntry(name: string): { key: string; entry: SkillEntry } | InstallResult {
  const status = statusMod.ensureConsistent();
  if (status.skills[name]) return { key: name, entry: status.skills[name]! };
  const matches = Object.entries(status.skills).filter(([, e]) => e.skill_name === name);
  if (matches.length === 1) return { key: matches[0]![0], entry: matches[0]![1] };
  if (matches.length > 1) return { error: "ambiguous", candidates: matches.map(([k]) => k) };
  return { error: "not_cached" };
}
```

(continued in next step — the function body is large; this step defines types + resolver.)

- [ ] **Step 4: Append the `installSkill` function body**

```typescript
// src/core/install.ts — append below resolveEntry
import { homedir } from "node:os";
import { resolvePlatformSkillsDir } from "@/platforms/skills-dir";

export function installSkill(input: InstallInput, home: string = homedir()): InstallResult {
  const resolved = resolveEntry(input.name);
  if (!("entry" in resolved)) return resolved; // error result
  const { key, entry } = resolved;

  const targetBaseDir = resolvePlatformSkillsDir(input.platform, home);
  if (!targetBaseDir) return { error: "platform_unknown" };

  // --- key safety (status.yaml is untrusted) ---
  if (!isSafeCacheKey(key)) return { error: "invalid_skill_path" };
  const cacheRoot = join(skillsDir(), key);
  let realCacheRoot: string;
  let realSkillsDir: string;
  try {
    realCacheRoot = fs.realpathSync(cacheRoot);
    realSkillsDir = fs.realpathSync(skillsDir());
  } catch { return { error: "invalid_skill_path" }; }
  if (!(realCacheRoot + sep).startsWith(realSkillsDir + sep)) return { error: "invalid_skill_path" };

  // --- source dir safety (primary_skill_path is untrusted) ---
  const srcSkillDir = dirname(join(cacheRoot, entry.primary_skill_path));
  let realSrcDir: string;
  try { realSrcDir = fs.realpathSync(srcSkillDir); }
  catch { return { error: "invalid_skill_path" }; }
  if (realSrcDir !== realCacheRoot && !(realSrcDir + sep).startsWith(realCacheRoot + sep)) {
    return { error: "invalid_skill_path" };
  }
  const skillPath = join(realSrcDir, "SKILL.md");
  try { if (!fs.lstatSync(skillPath).isFile()) return { error: "invalid_skill_path" }; }
  catch { return { error: "invalid_skill_path" }; }

  // --- target name safety ---
  if (!isSafeCacheKey(entry.skill_name)) return { error: "invalid_skill_name" };
  try { validateName(entry.skill_name); } catch { return { error: "invalid_skill_name" }; }
  const targetDir = join(targetBaseDir, entry.skill_name);
  if (!(resolve(targetDir) + sep).startsWith(resolve(targetBaseDir) + sep)) {
    return { error: "invalid_skill_name" };
  }
  const target_path = targetDir;

  // --- conflict: skip ---
  if (fs.existsSync(targetDir)) {
    return { skipped: true, reason: "exists", skill_name: entry.skill_name, platform: input.platform, target_path };
  }

  // --- copy into a unique tmp dir, then atomic rename ---
  fs.mkdirSync(targetBaseDir, { recursive: true });
  const tmpDir = fs.mkdtempSync(join(targetBaseDir, ".dora-install-"));
  let fileCount = 0;
  try {
    fileCount = copyTreeNoSymlinks(realSrcDir, tmpDir);
    if (!fs.existsSync(join(tmpDir, "SKILL.md"))) throw new Error("copy missing SKILL.md");
    fs.renameSync(tmpDir, targetDir);
  } catch (e) {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    if ((e as Error).message === SYMLINK_REJECTED) return { error: "invalid_skill_path" };
    throw e;
  } finally {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  // --- remove cache (status first, then dir) ---
  const status = statusMod.ensureConsistent();
  delete status.skills[key];
  try {
    statusMod.writeStatus(status);
  } catch (e) {
    fs.rmSync(targetDir, { recursive: true, force: true }); // rollback the install
    throw e;
  }
  let cacheRemoved = true;
  let cacheCleanupError: string | undefined;
  try { fs.rmSync(cacheRoot, { recursive: true, force: true }); }
  catch (e) { cacheRemoved = false; cacheCleanupError = (e as Error).message; }

  return {
    ok: true, skill_name: entry.skill_name, platform: input.platform,
    source_path: realSrcDir, target_path, file_count: fileCount,
    cache_removed: cacheRemoved, ...(cacheCleanupError ? { cache_cleanup_error: cacheCleanupError } : {}),
  };
}
```

Note: keep one `import * as fs from "node:fs"` and one `import * as statusMod from "./status"` at the top of the file (from Tasks 3-4). All fs/status calls go through these namespaces so Task 5 spies intercept them. `isSafeCacheKey`, `SYMLINK_REJECTED`, `copyTreeNoSymlinks` are already in this file from Tasks 2-3.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/core/install.test.ts`
Expected: PASS (all groups: isSafeCacheKey, copyTreeNoSymlinks, installSkill).

- [ ] **Step 6: Commit**

```bash
git add src/core/install.ts tests/core/install.test.ts
git commit -m "feat(install): add installSkill core move logic"
```

## Task 5: `installSkill` 安全与恢复路径测试

补齐 spec 要求的攻击面与故障恢复用例。纯测试任务,无实现改动(代码已在 Task 4 写好;若某用例失败说明 Task 4 实现有缺口,需回头修)。

**Files:**
- Modify: `tests/core/install.test.ts`(追加一个 `installSkill security & recovery` describe 块)

- [ ] **Step 1: Write the tests**

```typescript
// tests/core/install.test.ts — append. Reuses helpers/imports from Task 4's describe.
// These rely on the same writeCachedSkill + beforeEach/afterEach style; redeclare a
// local helper block mirroring Task 4 (cacheHome/platHome setup) inside this describe.

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
    // create an out-of-cache target the .. would point at
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
    seed("foo_alice", "SKILL.md", { "SKILL.md": "# foo" });
    const realRm = fs.rmSync;
    const spy = vi.spyOn(fs, "rmSync").mockImplementation(((p: fs.PathLike, opts?: object) => {
      if (String(p).includes(join("skills", "foo_alice"))) throw new Error("EBUSY");
      return realRm(p, opts as Parameters<typeof fs.rmSync>[1]);
    }) as typeof fs.rmSync);
    const r = installSkill({ name: "foo_alice", platform: "codex" }, platHome);
    expect(r.ok).toBe(true);
    expect(r.cache_removed).toBe(false);
    expect(r.cache_cleanup_error).toBeDefined();
    expect(existsSync(join(platHome, ".codex/skills/foo/SKILL.md"))).toBe(true);
    spy.mockRestore();
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
```

Test infra notes (add to top-of-file imports if not already present):
```typescript
import { vi } from "vitest";
import * as fs from "node:fs";
import * as statusMod from "@/core/status";
```

Important: `installSkill` (Task 4) calls `fs.rmSync` / `statusMod.writeStatus` via namespace objects, so `vi.spyOn(fs, "rmSync")` and `vi.spyOn(statusMod, "writeStatus")` intercept them. If install.ts ever switches back to named imports, these spies will silently NOT intercept — keep the namespace imports.

- [ ] **Step 3: Commit**

```bash
git add tests/core/install.test.ts src/core/install.ts
git commit -m "test(install): cover symlink/path-escape, cache-cleanup failure, writeStatus rollback"
```

## Task 6: MCP 工具 `dora_install`

Handler 负责平台解析(显式参数 > `DORA_PLATFORM` > `ctx.getDetection()`)与 home 注入,调 `installSkill`,序列化返回。

**Files:**
- Modify: `src/mcp/tools.ts`
- Test: `tests/mcp/tools.test.ts`(追加 dora_install 平台解析测试)

- [ ] **Step 1: Write the failing test**

```typescript
// tests/mcp/tools.test.ts — append. Reuses work/DORA_HOME/DORA_TEST setup at top.
import { homedir } from "node:os"; // if not already imported

describe("dora_install platform resolution", () => {
  const seedFoo = () => {
    mkdirSync(join(work, "skills", "foo_alice"), { recursive: true });
    writeFileSync(join(work, "skills", "foo_alice", "SKILL.md"), "# foo");
    writeStatus({ version: 1, skills: { foo_alice: {
      skill_name: "foo", owner: "alice", repo_url: "https://github.com/alice/foo",
      github_hash: "h", primary_skill_path: "SKILL.md", security_level: "safe",
      downloaded_at: "2026-05-01T00:00:00Z", last_used_at: "2026-05-01T00:00:00Z", use_count: 0,
    } } });
  };

  it("uses explicit platform arg over detection", async () => {
    seedFoo();
    const platHome = mkdtempSync(join(tmpdir(), "dora-h-"));
    const h = createHandlers({
      getDetection: () => ({ platform: "claude-code" as const, source: "env-signal" as const }),
      platformSkillsHome: platHome,
    });
    const r = JSON.parse(await h.dora_install({ name: "foo_alice", platform: "codex" }));
    expect(r.ok).toBe(true);
    expect(r.platform).toBe("codex");
    expect(r.target_path).toContain(join(".codex", "skills", "foo"));
    rmSync(platHome, { recursive: true, force: true });
  });

  it("falls back to DORA_PLATFORM env when no arg", async () => {
    seedFoo();
    const platHome = mkdtempSync(join(tmpdir(), "dora-h-"));
    process.env.DORA_PLATFORM = "gemini-cli";
    const h = createHandlers({
      getDetection: () => ({ platform: "claude-code" as const, source: "env-signal" as const }),
      platformSkillsHome: platHome,
    });
    const r = JSON.parse(await h.dora_install({ name: "foo_alice" }));
    expect(r.platform).toBe("gemini-cli");
    delete process.env.DORA_PLATFORM;
    rmSync(platHome, { recursive: true, force: true });
  });

  it("falls back to ctx.getDetection when no arg and no env", async () => {
    seedFoo();
    const platHome = mkdtempSync(join(tmpdir(), "dora-h-"));
    delete process.env.DORA_PLATFORM;
    const h = createHandlers({
      getDetection: () => ({ platform: "qwen-code" as const, source: "env-signal" as const }),
      platformSkillsHome: platHome,
    });
    const r = JSON.parse(await h.dora_install({ name: "foo_alice" }));
    expect(r.platform).toBe("qwen-code");
    rmSync(platHome, { recursive: true, force: true });
  });

  it("returns not_cached error for unknown name", async () => {
    writeStatus({ version: 1, skills: {} });
    const h = createHandlers({
      getDetection: () => ({ platform: "codex" as const, source: "env-signal" as const }),
      platformSkillsHome: mkdtempSync(join(tmpdir(), "dora-h-")),
    });
    const r = JSON.parse(await h.dora_install({ name: "ghost" }));
    expect(r.error).toBe("not_cached");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/mcp/tools.test.ts`
Expected: FAIL — `dora_install` not a function / `platformSkillsHome` not accepted.

- [ ] **Step 3: Extend `PlatformContext` and imports**

```typescript
// src/mcp/tools.ts — add to imports
import { homedir } from "node:os";
import { installSkill } from "@/core/install";

// extend interface
export interface PlatformContext {
  getDetection: () => DetectionResult;
  platformSkillsHome?: string;
}
```

- [ ] **Step 4: Add `InstallSchema` and the handler**

```typescript
// src/mcp/tools.ts — add near other schemas
const InstallSchema = z.object({ name: z.string().min(1), platform: z.string().optional() });

// inside createHandlers(...) return object, add this handler:
    async dora_install(args: unknown): Promise<string> {
      try {
        const a = InstallSchema.parse(args);
        const platform = a.platform ?? process.env.DORA_PLATFORM ?? ctx.getDetection().platform;
        const home = ctx.platformSkillsHome ?? homedir();
        const r = installSkill({ name: a.name, platform }, home);
        return JSON.stringify(r);
      } catch (e) { return err(e); }
    },
```

- [ ] **Step 5: Register in `toolDefs`**

```typescript
// src/mcp/tools.ts — add to the toolDefs array
  { name: "dora_install", description: "Move a cached skill into the current platform's system skills directory.", inputSchema: { type: "object", properties: { name: { type: "string" }, platform: { type: "string" } }, required: ["name"] } },
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/mcp/tools.test.ts`
Expected: PASS (4 new tests + existing pass).

- [ ] **Step 7: Commit**

```bash
git add src/mcp/tools.ts tests/mcp/tools.test.ts
git commit -m "feat(install): register dora_install MCP tool with handler-side platform resolution"
```

## Task 7: 用户命令 `skills/dora-install/SKILL.md`

用户命令入口,只负责解析参数、调 `dora_install`、按返回 JSON 分支展示。无测试(纯指令文件,随发布手测)。

**Files:**
- Create: `skills/dora-install/SKILL.md`

- [ ] **Step 1: Write the SKILL.md**

````markdown
---
name: dora-install
description: |
  Move a cached dora skill into the current platform's system skills directory.
  Accepts `<skill> [platform]` as $ARGUMENTS.
  Trigger: /dora:dora-install <skill> [platform]
user-invocable: true
---

# dora install

把 dora 缓存里的某个 skill 移动到当前平台的系统 skills 目录,并修正目录层次让 SKILL.md 落在顶层。

## Step 1 — No arguments?

If `$ARGUMENTS` is empty: call MCP tool `dora_list` with `{}`, display the returned table verbatim, then stop.

## Step 2 — Parse arguments

Split `$ARGUMENTS` on whitespace. First token = `name`. Optional second token = `platform` (one of: claude-code, codex, opencode, gemini-cli, qwen-code).

## Step 3 — Install

Call MCP tool `dora_install` with `{name, platform}` (omit `platform` if not given).

## Step 4 — Report

Branch on the returned JSON:

- `ok: true`, `cache_removed: true` → 「已把 `<skill_name>` 装到 `<platform>` 的 `<target_path>`,并清理了 dora 缓存。重启会话后可用。」
- `ok: true`, `cache_removed: false` → 「已把 `<skill_name>` 装到 `<platform>` 的 `<target_path>`,但清理缓存失败(`<cache_cleanup_error>`)。skill 已可用;残留缓存可用 `/dora:dora-purge` 清理。」
- `skipped: true` → 「`<target_path>` 已存在,未改动。如需重装请先删除该目录。」
- `error: "ambiguous"` → 列出 `candidates`,提示用完整 key(`<name>_<owner>`)重试。
- `error: "not_cached"` → 提示先用 `/dora:dora <任务>` 加载该 skill。
- `error: "platform_unknown"` → 提示加平台参数(claude-code/codex/opencode/gemini-cli/qwen-code)或设置 `DORA_PLATFORM` 环境变量。
- `error: "invalid_skill_path"` 或 `"invalid_skill_name"` → 提示缓存条目的路径或名称异常(status.yaml 可能损坏),建议 `/dora:dora-purge` 后重新加载。
````

- [ ] **Step 2: Verify the skill is discoverable**

The plugin manifest (`.claude-plugin/plugin.json`) already declares `"skills": "./skills/"`, so a new `skills/dora-install/` folder is auto-included. No manifest edit needed. Confirm the file exists:

Run: `ls skills/dora-install/SKILL.md`
Expected: prints the path.

- [ ] **Step 3: Commit**

```bash
git add skills/dora-install/SKILL.md
git commit -m "feat(install): add /dora:dora-install user command"
```

## Task 8: 全量验证(typecheck + test + build)

确保新代码通过类型检查、全部测试、以及打 bundle(发布产物)。

**Files:** none created — verification only.

- [ ] **Step 1: Typecheck**

Run: `npm run typecheck`
Expected: no errors. If `installSkill`'s discriminated `InstallResult` triggers narrowing errors in tests, ensure tests cast with `as Extract<...>` where shown (Task 5).

- [ ] **Step 2: Full test suite**

Run: `npm test`
Expected: all suites pass, including new `tests/platforms/skills-dir.test.ts`, `tests/core/install.test.ts`, and the `tests/mcp/tools.test.ts` additions.

- [ ] **Step 3: Build the bundles**

Run: `npm run build`
Expected: regenerates `cli.bundle.mjs` and `start.bundle.mjs` with no errors. These bundles embed the new `dora_install` tool and `skills/` are referenced at runtime.

- [ ] **Step 4: Smoke-test the tool end to end (optional but recommended)**

```bash
# verify dora_install is listed in the built tool defs
node -e "import('./cli.bundle.mjs').then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)})"
```
Expected: exits 0 (bundle loads without throwing). Deeper manual test: load a skill via `/dora:dora`, then `/dora:dora-install <name>` in a Claude Code session and confirm it lands in `~/.claude/skills/<name>/SKILL.md`.

- [ ] **Step 5: Commit the rebuilt bundles**

```bash
git add cli.bundle.mjs start.bundle.mjs
git commit -m "build: rebuild bundles with dora_install tool"
```

## Task 9: 文档 + 版本号 + 发布

7 个 README 同步加命令行;三处版本号 0.1.19 → 0.1.20;发布到 npm + GitHub release。

**Files:**
- Modify: `README.md`, `README.zh.md`, `README.ja.md`, `README.kr.md`, `README.fr.md`, `README.es.md`, `README.de.md`
- Modify: `package.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`

- [ ] **Step 1: Add the command row to every README**

Each file has the `/dora:dora-purge` row at line 41. Insert a new row immediately **after** it (so the table reads purge then install). Exact insertions per file:

```
README.md      → | `/dora:dora-install <skill> [platform]` | Move a cached skill into the current platform's system skills dir. |
README.zh.md   → | `/dora:dora-install <skill> [platform]` | 把已缓存的 skill 移动到当前平台的系统 skills 目录。 |
README.ja.md   → | `/dora:dora-install <skill> [platform]` | キャッシュ済みスキルを現在のプラットフォームのシステム skills ディレクトリへ移動。 |
README.kr.md   → | `/dora:dora-install <skill> [platform]` | 캐시된 스킬을 현재 플랫폼의 시스템 skills 디렉터리로 이동. |
README.fr.md   → | `/dora:dora-install <skill> [platform]` | Déplacer un skill en cache vers le répertoire skills système de la plateforme actuelle. |
README.es.md   → | `/dora:dora-install <skill> [platform]` | Mover un skill en caché al directorio skills del sistema de la plataforma actual. |
README.de.md   → | `/dora:dora-install <skill> [platform]` | Einen gecachten Skill in das System-Skills-Verzeichnis der aktuellen Plattform verschieben. |
```

Use Edit on each file: match the existing `dora-purge` line and append the new row right after it (the purge line text differs per language — see Task 9 grep output / the table above for each).

- [ ] **Step 2: Bump version in three manifests**

Edit each, changing `0.1.19` → `0.1.20`:
- `package.json`: `"version": "0.1.19"` → `"version": "0.1.20"`
- `.claude-plugin/plugin.json`: `"version": "0.1.19"` → `"version": "0.1.20"`
- `.claude-plugin/marketplace.json`: two occurrences — `metadata.version` and `plugins[0].version`, both `0.1.19` → `0.1.20`

- [ ] **Step 3: Verify nothing else references the old version**

Run: `grep -rn "0.1.19" package.json .claude-plugin/ README*.md`
Expected: no matches (all bumped). If README files embed a version badge, bump those too.

- [ ] **Step 4: Re-run build so bundles carry the new VERSION**

Run: `npm run build && npm test`
Expected: pass. (`VERSION` is sourced from `src/index.ts`/package — confirm `src/index.ts` reads it; if it hardcodes a version string, bump there too: `grep -n "0.1.19" src/index.ts`.)

- [ ] **Step 5: Commit docs + version**

```bash
git add README*.md package.json .claude-plugin/ cli.bundle.mjs start.bundle.mjs
git commit -m "docs: document /dora:dora-install; chore: bump to 0.1.20"
```

- [ ] **Step 6: Publish (npm + GitHub release)**

Per the project's established release workflow (publish to BOTH npm and a GitHub release on every version bump). Confirm with the user before running these — publishing is irreversible:

```bash
npm publish --access public
gh release create v0.1.20 --title "v0.1.20" --notes "Add /dora:dora-install: move a cached skill into the current platform's system skills directory (claude-code/codex/opencode/gemini-cli/qwen-code)."
```

- [ ] **Step 7: Push the branch and open a PR** (if not already pushed)

```bash
git push -u origin <branch>
gh pr create --title "feat: add /dora:dora-install command" --body "Move a cached skill into the current platform's system skills directory. See docs/superpowers/specs/2026-06-03-dora-install-command-design.md"
```








