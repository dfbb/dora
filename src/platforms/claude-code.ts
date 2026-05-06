import type { PlatformAdapter } from "./types";
import { ROUTING_WITH_CONTEXT } from "./types";

export const claudeCode: PlatformAdapter = {
  name: "claude-code",
  installFiles: () => [],
  sessionStartHook: () => ({
    hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: ROUTING_WITH_CONTEXT },
  }),
};
