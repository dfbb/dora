import type { PlatformAdapter } from "./types";
import { ROUTING_WITH_CONTEXT } from "./types";

const OPENCODE_JSON = JSON.stringify({
  $schema: "https://opencode.ai/config.json",
  mcp: { dora: { type: "local", command: ["dora", "mcp"] } },
}, null, 2);

export const opencode: PlatformAdapter = {
  name: "opencode",
  installFiles: () => [
    { path: "opencode.json", content: OPENCODE_JSON, mode: "json-merge" },
    { path: "AGENTS.md", content: ROUTING_WITH_CONTEXT + "\n", mode: "append-if-missing", marker: "<!-- dora:routing -->" },
  ],
  sessionStartHook: () => ({
    hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: ROUTING_WITH_CONTEXT },
  }),
};
