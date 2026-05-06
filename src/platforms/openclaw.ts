import type { PlatformAdapter } from "./types";
import { ROUTING_WITH_CONTEXT } from "./types";

const OPENCLAW_JSON = JSON.stringify({
  plugins: { entries: { dora: { command: "dora", args: ["mcp"] } } },
}, null, 2);

export const openClaw: PlatformAdapter = {
  name: "openclaw",
  installFiles: () => [
    { path: "openclaw.json", content: OPENCLAW_JSON, mode: "json-merge", backup: true, atomic: true },
  ],
  sessionStartHook: () => ({
    hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: ROUTING_WITH_CONTEXT },
  }),
};
