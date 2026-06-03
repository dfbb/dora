import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { resolvePlatformSkillsDir, PLATFORM_SKILLS_SUBDIR } from "@/platforms/skills-dir";

describe("resolvePlatformSkillsDir", () => {
  it("maps each known platform to <home>/<subdir>", () => {
    const home = "/tmp/fakehome";
    expect(resolvePlatformSkillsDir("claude-code", home)).toBe(join(home, ".claude/skills"));
    expect(resolvePlatformSkillsDir("codex", home)).toBe(join(home, ".codex/skills"));
    expect(resolvePlatformSkillsDir("opencode", home)).toBe(join(home, ".config/opencode/skills"));
    expect(resolvePlatformSkillsDir("gemini-cli", home)).toBe(join(home, ".gemini/skills"));
    expect(resolvePlatformSkillsDir("qwen-code", home)).toBe(join(home, ".qwen/skills"));
  });

  it("returns null for unknown / unmapped platform", () => {
    expect(resolvePlatformSkillsDir("unknown", "/tmp/h")).toBeNull();
    expect(resolvePlatformSkillsDir("nonsense", "/tmp/h")).toBeNull();
  });

  it("defaults home to homedir() when omitted", () => {
    const r = resolvePlatformSkillsDir("codex");
    expect(r).toMatch(/\.codex[/\\]skills$/);
  });

  it("exposes a subdir for all five platforms", () => {
    expect(Object.keys(PLATFORM_SKILLS_SUBDIR).sort()).toEqual(
      ["claude-code", "codex", "gemini-cli", "opencode", "qwen-code"]
    );
  });
});
