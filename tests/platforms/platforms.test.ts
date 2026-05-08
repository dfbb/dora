import { describe, expect, it } from "vitest";
import { codex } from "@/platforms/codex";
import { opencode } from "@/platforms/opencode";
import { claudeCode } from "@/platforms/claude-code";
import { geminiCli } from "@/platforms/gemini-cli";
import { qwenCode } from "@/platforms/qwen-code";

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
  it("AGENTS.md uses append-if-missing with marker", () => {
    const agents = codex.installFiles().find((f) => f.path.endsWith("AGENTS.md"))!;
    expect(agents.mode).toBe("append-if-missing");
    expect(agents.marker).toBe("<!-- dora:routing -->");
    expect(agents.content).toContain("<!-- dora:routing -->");
    expect(agents.content).toContain("execution_context");
  });
  it("config.toml uses toml-merge with backup", () => {
    const cfg = codex.installFiles().find((f) => f.path.endsWith("config.toml"))!;
    expect(cfg.mode).toBe("toml-merge");
    expect(cfg.backup).toBe(true);
    expect(cfg.atomic).toBe(true);
  });
});

describe("opencode adapter", () => {
  it("install files include opencode.json + AGENTS.md", () => {
    const paths = opencode.installFiles().map((f) => f.path);
    expect(paths).toContain("opencode.json");
    expect(paths).toContain("AGENTS.md");
  });
  it("AGENTS.md uses append-if-missing with marker", () => {
    const agents = opencode.installFiles().find((f) => f.path.endsWith("AGENTS.md"))!;
    expect(agents.mode).toBe("append-if-missing");
    expect(agents.marker).toBe("<!-- dora:routing -->");
  });
});

describe("claude-code adapter", () => {
  it("hook returns ROUTING_WITH_CONTEXT including execution_context instruction", () => {
    const out = claudeCode.sessionStartHook({ hook_event_name: "SessionStart" });
    expect(out.hookSpecificOutput.additionalContext).toContain("dora_query");
    expect(out.hookSpecificOutput.additionalContext).toContain("execution_context");
  });
});

describe("gemini-cli adapter", () => {
  it("install files include settings.json and GEMINI.md", () => {
    const paths = geminiCli.installFiles().map((f) => f.path);
    expect(paths).toContain("~/.gemini/settings.json");
    expect(paths).toContain("GEMINI.md");
  });
  it("settings.json uses json-merge with backup", () => {
    const cfg = geminiCli.installFiles().find((f) => f.path.endsWith("settings.json"))!;
    expect(cfg.mode).toBe("json-merge");
    expect(cfg.backup).toBe(true);
    expect(cfg.atomic).toBe(true);
  });
  it("GEMINI.md uses append-if-missing", () => {
    const routing = geminiCli.installFiles().find((f) => f.path.endsWith("GEMINI.md"))!;
    expect(routing.mode).toBe("append-if-missing");
    expect(routing.marker).toBe("<!-- dora:routing -->");
  });
});

describe("qwen-code adapter", () => {
  it("install files include settings.json", () => {
    const paths = qwenCode.installFiles().map((f) => f.path);
    expect(paths).toContain("~/.qwen/settings.json");
  });
  it("settings.json uses json-merge with backup", () => {
    const cfg = qwenCode.installFiles().find((f) => f.path.endsWith("settings.json"))!;
    expect(cfg.mode).toBe("json-merge");
    expect(cfg.backup).toBe(true);
    expect(cfg.atomic).toBe(true);
  });
});
