import type { PlatformAdapter } from "./types";
import { ROUTING } from "./types";

const OPENCODE_JSON = JSON.stringify({
  $schema: "https://opencode.ai/config.json",
  mcp: { dora: { type: "local", command: ["dora", "mcp"] } },
}, null, 2);
const AGENTS = `# dora\n\n${ROUTING}\n`;

export const opencode: PlatformAdapter = {
  name: "opencode",
  installFiles: () => [
    { path: "opencode.json", content: OPENCODE_JSON, mode: "json-merge" },
    { path: "AGENTS.md", content: AGENTS, mode: "skip-if-exists" },
  ],
  sessionStartHook: () => ({
    hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: ROUTING },
  }),
};
