import type { PlatformAdapter } from "./types";
import { ROUTING } from "./types";

const HOOKS_JSON = JSON.stringify({
  hooks: {
    SessionStart: [{ hooks: [{ type: "command", command: "dora hook codex sessionstart" }] }],
  },
}, null, 2);

const CONFIG_TOML = `[mcp_servers.dora]\ncommand = "dora"\nargs = ["mcp"]\n`;
const AGENTS_MD = `# dora\n\n${ROUTING}\n`;

export const codex: PlatformAdapter = {
  name: "codex",
  installFiles: () => [
    { path: "~/.codex/config.toml", content: CONFIG_TOML, mode: "skip-if-exists" },
    { path: "~/.codex/hooks.json", content: HOOKS_JSON, mode: "json-merge" },
    { path: "~/.codex/AGENTS.md", content: AGENTS_MD, mode: "skip-if-exists" },
  ],
  sessionStartHook: () => ({
    hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: ROUTING },
  }),
};
