import type { PlatformAdapter } from "./types";
import { ROUTING_WITH_CONTEXT } from "./types";

const CONFIG_TOML = `[mcp_servers.dora]\ncommand = "dora"\nargs = ["mcp"]\n\n[mcp_servers.dora.env]\nDORA_PLATFORM = "codex"\n`;

export const codex: PlatformAdapter = {
  name: "codex",
  // Routing is delivered silently via ~/.codex/AGENTS.md (read as a system
  // instruction). We intentionally do NOT register a SessionStart hook: Codex
  // surfaces a hook's additionalContext to the user, which duplicated the
  // AGENTS.md routing as visible noise on every session start.
  installFiles: () => [
    { path: "~/.codex/config.toml", content: CONFIG_TOML, mode: "toml-merge", backup: true, atomic: true },
    { path: "~/.codex/AGENTS.md", content: ROUTING_WITH_CONTEXT + "\n", mode: "append-if-missing", marker: "<!-- dora:routing -->" },
  ],
  sessionStartHook: () => ({
    hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: ROUTING_WITH_CONTEXT },
  }),
};
