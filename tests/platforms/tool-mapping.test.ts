// tests/platforms/tool-mapping.test.ts
import { describe, expect, it } from "vitest";
import { generateExecutionContext, TOOL_MAPPINGS } from "@/platforms/tool-mapping";
import type { DetectionResult } from "@/platforms/detect";

describe("generateExecutionContext", () => {
  it("returns null for claude-code (native)", () => {
    const d: DetectionResult = { platform: "claude-code", source: "env-signal" };
    expect(generateExecutionContext(d)).toBeNull();
  });

  it("returns null for cursor (native)", () => {
    const d: DetectionResult = { platform: "cursor", source: "env-override" };
    expect(generateExecutionContext(d)).toBeNull();
  });

  it("returns mapping table for gemini-cli", () => {
    const d: DetectionResult = { platform: "gemini-cli", source: "clientInfo" };
    const ctx = generateExecutionContext(d)!;
    expect(ctx).toContain("read_file");
    expect(ctx).toContain("run_shell_command");
    expect(ctx).toContain("Not supported");
  });

  it("returns mapping table for opencode", () => {
    const d: DetectionResult = { platform: "opencode", source: "env-signal" };
    const ctx = generateExecutionContext(d)!;
    expect(ctx).toContain("`Read` → `read`");
    expect(ctx).toContain("`Bash` → `shell`");
  });

  it("returns unverified note for qwen-code", () => {
    const d: DetectionResult = { platform: "qwen-code", source: "clientInfo" };
    const ctx = generateExecutionContext(d)!;
    expect(ctx).toContain("not been verified");
  });

  it("returns warning for unknown", () => {
    const d: DetectionResult = { platform: "unknown", source: "fallback" };
    const ctx = generateExecutionContext(d)!;
    expect(ctx).toContain("DORA_PLATFORM");
    expect(ctx).toContain("Could not detect");
  });

  it("prepends warning when DetectionResult has warning", () => {
    const d: DetectionResult = {
      platform: "unknown",
      source: "env-override",
      warning: 'invalid DORA_PLATFORM value: "nope"',
    };
    const ctx = generateExecutionContext(d)!;
    expect(ctx).toContain("⚠️");
    expect(ctx).toContain("nope");
    expect(ctx).toContain("Could not detect");
  });

  it("TOOL_MAPPINGS covers all PlatformId values", () => {
    const ids = [
      "claude-code", "codex", "openclaw", "opencode",
      "gemini-cli", "qwen-code", "cursor", "unknown",
    ];
    for (const id of ids) {
      expect(TOOL_MAPPINGS[id as keyof typeof TOOL_MAPPINGS]).toBeDefined();
    }
  });
});
