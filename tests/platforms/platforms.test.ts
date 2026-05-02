import { describe, expect, it } from "vitest";
import { codex } from "@/platforms/codex";
import { cursor } from "@/platforms/cursor";
import { opencode } from "@/platforms/opencode";
import { claudeCode } from "@/platforms/claude-code";

describe("codex adapter", () => {
  it("emits hookSpecificOutput.additionalContext on sessionstart", () => {
    const out = codex.sessionStartHook({ hook_event_name: "SessionStart" });
    expect(out.hookSpecificOutput.additionalContext).toMatch(/dora_query/);
  });
  it("install files include hooks.json + AGENTS.md", () => {
    const files = codex.installFiles();
    const paths = files.map((f) => f.path);
    expect(paths).toContain("~/.codex/hooks.json");
    expect(paths).toContain("~/.codex/AGENTS.md");
  });
});

describe("cursor adapter", () => {
  it("install files include mcp.json + rules .mdc", () => {
    const paths = cursor.installFiles().map((f) => f.path);
    expect(paths).toContain(".cursor/mcp.json");
    expect(paths).toContain(".cursor/rules/dora.mdc");
  });
});

describe("opencode adapter", () => {
  it("install files include opencode.json + AGENTS.md", () => {
    const paths = opencode.installFiles().map((f) => f.path);
    expect(paths).toContain("opencode.json");
    expect(paths).toContain("AGENTS.md");
  });
});

describe("claude-code adapter", () => {
  it("hook returns additionalContext markdown", () => {
    const out = claudeCode.sessionStartHook({ hook_event_name: "SessionStart" });
    expect(out.hookSpecificOutput.additionalContext).toMatch(/dora_query/);
  });
});
