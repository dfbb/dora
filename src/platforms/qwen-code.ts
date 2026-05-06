import type { PlatformAdapter } from "./types";
import { ROUTING_WITH_CONTEXT } from "./types";

const SETTINGS_JSON = JSON.stringify({
  mcpServers: { dora: { command: "dora", args: ["mcp"], type: "stdio" } },
}, null, 2);

export const qwenCode: PlatformAdapter = {
  name: "qwen-code",
  installFiles: () => [
    { path: "~/.qwen/settings.json", content: SETTINGS_JSON, mode: "json-merge", backup: true, atomic: true },
  ],
  sessionStartHook: () => ({
    hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: ROUTING_WITH_CONTEXT },
  }),
};
