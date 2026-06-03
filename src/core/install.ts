import { isAbsolute, join, dirname, resolve, sep } from "node:path";
import * as fs from "node:fs";
import { homedir } from "node:os";
import * as statusMod from "./status";
import { skillsDir } from "./paths";
import { validateName } from "./validate";
import type { SkillEntry } from "./types";
import { resolvePlatformSkillsDir } from "@/platforms/skills-dir";

/**
 * Guards a cache key (`<skillName>_<owner>` from the untrusted status.yaml)
 * before it is used to build a filesystem path. Rejects empty, the `.`/`..`
 * segments, absolute paths, and any path separator. A `..` *substring* inside
 * a single segment (e.g. `foo_..`) is allowed — only a whole `..` segment
 * traverses upward.
 */
// True if `child` is `base` itself or a path nested inside it. Both args must
// already be resolved (realpath/resolve) so symlinks and `..` can't fool the
// prefix check; the trailing separator prevents sibling-prefix false positives
// (e.g. "/a/bc" is NOT inside "/a/b").
function isContained(child: string, base: string): boolean {
  return (child + sep).startsWith(base + sep);
}

export function isSafeCacheKey(key: string): boolean {
  if (!key) return false;
  if (key === "." || key === "..") return false;
  if (isAbsolute(key)) return false; // belt-and-suspenders: also covers Windows drive/UNC absolute forms
  if (key.includes("/") || key.includes("\\")) return false;
  return true;
}

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

export interface InstallInput { name: string; platform: string; }

export type InstallErrorCode =
  | "not_cached" | "ambiguous" | "platform_unknown" | "invalid_skill_path" | "invalid_skill_name";

// Flat result shape (not a discriminated union): every field optional so tests
// can read r.ok / r.error / r.skipped without TS narrowing errors (tests are in
// tsconfig include under strict mode). It is JSON-serialized verbatim by the
// MCP handler, so a flat bag of optional fields is exactly what the consumer wants.
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
  if (!isContained(realCacheRoot, realSkillsDir)) return { error: "invalid_skill_path" };

  // --- source dir safety (primary_skill_path is untrusted) ---
  const srcSkillDir = dirname(join(cacheRoot, entry.primary_skill_path));
  let realSrcDir: string;
  try { realSrcDir = fs.realpathSync(srcSkillDir); }
  catch { return { error: "invalid_skill_path" }; }
  if (!isContained(realSrcDir, realCacheRoot)) {
    return { error: "invalid_skill_path" };
  }
  const skillPath = join(realSrcDir, "SKILL.md");
  try { if (!fs.lstatSync(skillPath).isFile()) return { error: "invalid_skill_path" }; }
  catch { return { error: "invalid_skill_path" }; }

  // --- target name safety ---
  if (!isSafeCacheKey(entry.skill_name)) return { error: "invalid_skill_name" };
  try { validateName(entry.skill_name); } catch { return { error: "invalid_skill_name" }; }
  const targetDir = join(targetBaseDir, entry.skill_name);
  if (!isContained(resolve(targetDir), resolve(targetBaseDir))) {
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

