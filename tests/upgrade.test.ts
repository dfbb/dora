import { describe, expect, it, afterEach } from "vitest";
import { buildUpgradeCommand } from "@/upgrade";

const orig = { ...process.env };
afterEach(() => { process.env = { ...orig }; });

describe("buildUpgradeCommand", () => {
  it("derives plugin@marketplace from standard cache path", () => {
    process.env.CLAUDE_PLUGIN_ROOT = "/home/user/.claude/plugins/cache/dora/dora/0.1.0";
    expect(buildUpgradeCommand()).toBe("claude plugin update dora@dora");
  });

  it("falls back to dora@dora for short/unrecognized paths", () => {
    process.env.CLAUDE_PLUGIN_ROOT = "/plugin/root";
    expect(buildUpgradeCommand()).toBe("claude plugin update dora@dora");
  });

  it("npm global path when CLAUDE_PLUGIN_ROOT not set", () => {
    delete process.env.CLAUDE_PLUGIN_ROOT;
    expect(buildUpgradeCommand()).toBe("npm install -g dora@latest && dora doctor");
  });
});
