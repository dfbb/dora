import type { PlatformAdapter } from "./types";
import { ROUTING } from "./types";

export const claudeCode: PlatformAdapter = {
  name: "claude-code",
  installFiles: () => [],
  sessionStartHook: () => ({
    hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: ROUTING },
  }),
};
