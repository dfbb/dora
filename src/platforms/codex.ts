import type { PlatformAdapter } from "./types";
import { ROUTING_WITH_CONTEXT } from "./types";

const HOOKS_JSON = JSON.stringify({
  hooks: {
    SessionStart: [{ hooks: [{ type: "command", command: "dora hook codex sessionstart" }] }],
  },
}, null, 2);

const CONFIG_TOML = `[mcp_servers.dora]\ncommand = "dora"\nargs = ["mcp"]\n`;

export const codex: PlatformAdapter = {
  name: "codex",
  installFiles: () => [
    { path: "~/.codex/config.toml", content: CONFIG_TOML, mode: "toml-merge", backup: true, atomic: true },
    { path: "~/.codex/hooks.json", content: HOOKS_JSON, mode: "json-merge" },
    { path: "~/.codex/AGENTS.md", content: ROUTING_WITH_CONTEXT + "\n", mode: "append-if-missing", marker: "<!-- dora:routing -->" },
  ],
  sessionStartHook: () => ({
    hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: ROUTING_WITH_CONTEXT },
  }),
};
