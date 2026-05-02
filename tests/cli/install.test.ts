import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInstall } from "@/cli/commands/install";

let work: string;
const orig = { ...process.env };
const origCwd = process.cwd();

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), "dora-install-"));
  process.env.HOME = work;
  process.chdir(work);
});
afterEach(() => {
  process.chdir(origCwd);
  process.env = { ...orig };
  rmSync(work, { recursive: true, force: true });
});

describe("install:cursor", () => {
  it("writes mcp.json and dora.mdc to cwd", () => {
    runInstall("cursor", []);
    expect(existsSync(join(work, ".cursor/mcp.json"))).toBe(true);
    expect(existsSync(join(work, ".cursor/rules/dora.mdc"))).toBe(true);
  });

  it("merges with existing mcp.json", () => {
    mkdirSync(join(work, ".cursor"), { recursive: true });
    writeFileSync(join(work, ".cursor/mcp.json"), JSON.stringify({ mcpServers: { other: { command: "x" } } }));
    runInstall("cursor", []);
    const merged = JSON.parse(readFileSync(join(work, ".cursor/mcp.json"), "utf8"));
    expect(merged.mcpServers.other).toBeDefined();
    expect(merged.mcpServers.dora).toBeDefined();
  });

  it("--dry-run does not write", () => {
    runInstall("cursor", ["--dry-run"]);
    expect(existsSync(join(work, ".cursor/mcp.json"))).toBe(false);
  });
});
