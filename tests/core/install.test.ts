import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, symlinkSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isSafeCacheKey, copyTreeNoSymlinks, SYMLINK_REJECTED } from "@/core/install";

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
