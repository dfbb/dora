import type { PlatformAdapter } from "./types";
import { ROUTING_WITH_CONTEXT } from "./types";

const SETTINGS_JSON = JSON.stringify({
  mcpServers: { dora: { command: "dora", args: ["mcp"], type: "stdio" } },
}, null, 2);

export const geminiCli: PlatformAdapter = {
  name: "gemini-cli",
  installFiles: () => [
    { path: "~/.gemini/settings.json", content: SETTINGS_JSON, mode: "json-merge", backup: true, atomic: true },
    { path: "GEMINI.md", content: ROUTING_WITH_CONTEXT + "\n", mode: "append-if-missing", marker: "<!-- dora:routing -->" },
  ],
  sessionStartHook: () => ({
    hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: ROUTING_WITH_CONTEXT },
  }),
};
