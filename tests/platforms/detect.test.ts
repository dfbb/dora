import { describe, expect, it } from "vitest";
import { detectRuntimePlatform } from "@/platforms/detect";
import type { DetectionResult, PlatformId } from "@/platforms/detect";

describe("detectRuntimePlatform", () => {
  it("returns unknown with fallback source when no signals", () => {
    const result = detectRuntimePlatform(undefined, {});
    expect(result.platform).toBe("unknown");
    expect(result.source).toBe("fallback");
    expect(result.warning).toBeUndefined();
  });
});
