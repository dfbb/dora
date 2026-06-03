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

  it("rejects null/undefined at runtime", () => {
    expect(isSafeCacheKey(null as unknown as string)).toBe(false);
    expect(isSafeCacheKey(undefined as unknown as string)).toBe(false);
  });
});
