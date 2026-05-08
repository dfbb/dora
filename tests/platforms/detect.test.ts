// tests/platforms/detect.test.ts — replace full contents
import { describe, expect, it } from "vitest";
import { detectRuntimePlatform } from "@/platforms/detect";

describe("detectRuntimePlatform", () => {
  it("returns unknown with fallback source when no signals", () => {
    const r = detectRuntimePlatform(undefined, {});
    expect(r).toEqual({ platform: "unknown", source: "fallback" });
  });

  it("DORA_PLATFORM override takes highest priority", () => {
    const r = detectRuntimePlatform(
      { name: "claude-code" },
      { DORA_PLATFORM: "codex" },
    );
    expect(r.platform).toBe("codex");
    expect(r.source).toBe("env-override");
  });

  it("invalid DORA_PLATFORM returns unknown with warning", () => {
    const r = detectRuntimePlatform(undefined, { DORA_PLATFORM: "nope" });
    expect(r.platform).toBe("unknown");
    expect(r.source).toBe("env-override");
    expect(r.warning).toContain("nope");
  });

  it("clientInfo.name gemini-cli-mcp-client returns gemini-cli", () => {
    const r = detectRuntimePlatform({ name: "gemini-cli-mcp-client" }, {});
    expect(r.platform).toBe("gemini-cli");
    expect(r.source).toBe("clientInfo");
  });

  it("clientInfo.name case-insensitive for Codex", () => {
    const r = detectRuntimePlatform({ name: "Codex" }, {});
    expect(r.platform).toBe("codex");
    expect(r.source).toBe("clientInfo");
  });

  it("qwen-cli-mcp-client prefix match", () => {
    const r = detectRuntimePlatform({ name: "qwen-cli-mcp-client-foo" }, {});
    expect(r.platform).toBe("qwen-code");
    expect(r.source).toBe("clientInfo");
  });

  it("OPENCODE env var returns opencode", () => {
    const r = detectRuntimePlatform(undefined, { OPENCODE: "1" });
    expect(r.platform).toBe("opencode");
    expect(r.source).toBe("env-signal");
  });

  it("CLAUDE_PROJECT_DIR env var returns claude-code", () => {
    const r = detectRuntimePlatform(undefined, { CLAUDE_PROJECT_DIR: "/tmp" });
    expect(r.platform).toBe("claude-code");
    expect(r.source).toBe("env-signal");
  });
});
