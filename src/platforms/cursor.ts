import type { PlatformAdapter } from "./types";
import { ROUTING } from "./types";

const MCP_JSON = JSON.stringify({ mcpServers: { dora: { command: "dora", args: ["mcp"] } } }, null, 2);
const MDC = `---\ndescription: dora skill discovery\nalwaysApply: true\n---\n\n${ROUTING}\n`;

export const cursor: PlatformAdapter = {
  name: "cursor",
  installFiles: () => [
    { path: ".cursor/mcp.json", content: MCP_JSON, mode: "json-merge" },
    { path: ".cursor/rules/dora.mdc", content: MDC, mode: "write" },
  ],
  sessionStartHook: () => ({
    hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: ROUTING },
  }),
};
