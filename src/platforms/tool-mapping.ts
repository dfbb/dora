import type { DetectionResult, PlatformId } from "./detect";

export type PlatformMapping =
  | { kind: "native" }
  | { kind: "mapping"; tools: Record<string, string | null> }
  | { kind: "unverified" }
  | { kind: "warning"; text: string };

export const TOOL_MAPPINGS: Record<PlatformId, PlatformMapping> = {
  "claude-code": { kind: "native" },
  cursor: { kind: "native" },
  openclaw: { kind: "unverified" },
  "qwen-code": { kind: "unverified" },
  opencode: {
    kind: "mapping",
    tools: {
      Read: "read", Write: "write", Edit: "edit",
      Bash: "shell", Skill: "skill", Task: "task",
      WebFetch: "fetch", WebSearch: "search",
      TodoWrite: "todo",
    },
  },
  "gemini-cli": {
    kind: "mapping",
    tools: {
      Read: "read_file", Write: "write_file", Edit: "replace",
      Bash: "run_shell_command", Skill: "activate_skill",
      WebSearch: "google_web_search", WebFetch: "web_fetch",
      Task: null,
    },
  },
  codex: {
    kind: "mapping",
    tools: {
      Read: "native file tools", Write: "native file tools",
      Edit: "native file tools", Bash: "native shell tools",
      Skill: "native loading", Task: "spawn_agent",
      TodoWrite: "update_plan",
    },
  },
  unknown: {
    kind: "warning",
    text: [
      "## Platform Adaptation Warning",
      "",
      "Could not detect your CLI platform. This skill uses Claude Code tool names",
      "(Read, Write, Edit, Bash, Skill, Task, etc.). If your CLI uses different",
      "tool names, you may need to adapt the commands manually.",
      "",
      "To specify your platform explicitly, set: DORA_PLATFORM=<platform-id>",
      "Supported overrides: claude-code, codex, openclaw, opencode, gemini-cli, qwen-code, cursor (manual fallback only)",
    ].join("\n"),
  },
};

export function generateExecutionContext(detection: DetectionResult): string | null {
  const mapping = TOOL_MAPPINGS[detection.platform];

  let context: string | null = null;

  switch (mapping.kind) {
    case "native":
      context = null;
      break;
    case "mapping": {
      const lines = ["## Tool Name Mapping", "", "This skill uses Claude Code tool names. On your platform, use:", ""];
      for (const [from, to] of Object.entries(mapping.tools)) {
        lines.push(to === null ? `- \`${from}\` → Not supported on this platform` : `- \`${from}\` → \`${to}\``);
      }
      lines.push("", "After reading the skill instructions, translate all tool references using this mapping.");
      context = lines.join("\n");
      break;
    }
    case "unverified":
      context = [
        "## Platform Compatibility Note",
        "",
        "This platform's tool names have not been verified against Claude Code conventions.",
        "Tool names may be identical. If a tool call fails, adapt to your platform's native tool names.",
      ].join("\n");
      break;
    case "warning":
      context = mapping.text;
      break;
  }

  if (detection.warning && context) {
    context = `> ⚠️ ${detection.warning}\n\n${context}`;
  } else if (detection.warning) {
    context = `> ⚠️ ${detection.warning}`;
  }

  return context;
}
