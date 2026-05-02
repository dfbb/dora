import { describe, expect, it, afterEach } from "vitest";
import { buildUpgradeCommand } from "@/upgrade";

const orig = { ...process.env };
afterEach(() => { process.env = { ...orig }; });

describe("buildUpgradeCommand", () => {
  it("plugin path when CLAUDE_PLUGIN_ROOT set", () => {
    process.env.CLAUDE_PLUGIN_ROOT = "/plugin/root";
    expect(buildUpgradeCommand()).toBe(
      "cd /plugin/root && git pull && npm install && npm run build && dora doctor"
    );
  });
  it("npm global path otherwise", () => {
    delete process.env.CLAUDE_PLUGIN_ROOT;
    expect(buildUpgradeCommand()).toBe("npm install -g dora@latest && dora doctor");
  });
});
