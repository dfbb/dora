import { homedir } from "node:os";
import { join } from "node:path";

// Platforms that have a global "<name>/SKILL.md" system skills directory, keyed by platform id -> home-relative subpath.
export const PLATFORM_SKILLS_SUBDIR: Record<string, string> = {
  "claude-code": ".claude/skills",
  codex: ".codex/skills",
  opencode: ".config/opencode/skills",
  "gemini-cli": ".gemini/skills",
  "qwen-code": ".qwen/skills",
};

/**
 * Maps a platform id to its global skills directory under `home`.
 * Accepts an arbitrary string on purpose — callers pass unvalidated values
 * from MCP args / the DORA_PLATFORM env var. Returns null for any unknown
 * platform, which callers translate into a "platform_unknown" error.
 */
export function resolvePlatformSkillsDir(platform: string, home: string = homedir()): string | null {
  const sub = PLATFORM_SKILLS_SUBDIR[platform];
  if (!sub) return null;
  return join(home, sub);
}
