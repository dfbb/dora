import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInstall } from "@/cli/commands/install";

let work: string;
const origHome = process.env.HOME;
const origCwd = process.cwd();

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), "dora-install-"));
  process.env.HOME = work;
  process.chdir(work);
});
afterEach(() => {
  process.chdir(origCwd);
  if (origHome !== undefined) process.env.HOME = origHome;
  else delete process.env.HOME;
  rmSync(work, { recursive: true, force: true });
});

describe("deep merge (json-merge)", () => {
  it("preserves three-level nested keys", () => {
    mkdirSync(join(work, ".gemini"), { recursive: true });
    writeFileSync(
      join(work, ".gemini/settings.json"),
      JSON.stringify({
        mcpServers: { other: { command: "x", args: ["y"] } },
      }),
    );
    runInstall("gemini-cli", []);
    const result = JSON.parse(readFileSync(join(work, ".gemini/settings.json"), "utf8"));
    expect(result.mcpServers.other).toEqual({ command: "x", args: ["y"] });
    expect(result.mcpServers.dora).toBeDefined();
  });

  it("does not flatten arrays (arrays replaced, not merged)", () => {
    mkdirSync(join(work, ".gemini"), { recursive: true });
    writeFileSync(
      join(work, ".gemini/settings.json"),
      JSON.stringify({ mcpServers: { other: { command: "x", args: ["a", "b"] } } }),
    );
    runInstall("gemini-cli", []);
    const result = JSON.parse(readFileSync(join(work, ".gemini/settings.json"), "utf8"));
    // arrays in existing are preserved since dora key doesn't overlap
    expect(result.mcpServers.other.args).toEqual(["a", "b"]);
  });
});

describe("install:codex (toml-merge + append-if-missing + backup)", () => {
  it("creates config.toml and AGENTS.md from scratch", () => {
    runInstall("codex", []);
    expect(existsSync(join(work, ".codex/config.toml"))).toBe(true);
    expect(existsSync(join(work, ".codex/AGENTS.md"))).toBe(true);
    expect(existsSync(join(work, ".codex/hooks.json"))).toBe(true);
    const toml = readFileSync(join(work, ".codex/config.toml"), "utf8");
    expect(toml).toContain("dora");
  });

  it("toml-merge preserves existing keys", () => {
    mkdirSync(join(work, ".codex"), { recursive: true });
    writeFileSync(join(work, ".codex/config.toml"), `[mcp_servers.other]\ncommand = "x"\n`);
    runInstall("codex", []);
    const toml = readFileSync(join(work, ".codex/config.toml"), "utf8");
    expect(toml).toContain("other");
    expect(toml).toContain("dora");
  });

  it("toml-merge creates .bak for existing file", () => {
    mkdirSync(join(work, ".codex"), { recursive: true });
    writeFileSync(join(work, ".codex/config.toml"), `[mcp_servers.other]\ncommand = "x"\n`);
    runInstall("codex", []);
    expect(existsSync(join(work, ".codex/config.toml.bak"))).toBe(true);
    const bak = readFileSync(join(work, ".codex/config.toml.bak"), "utf8");
    expect(bak).toContain("other");
    expect(bak).not.toContain("dora");
  });

  it("toml-merge returns error on corrupted TOML", () => {
    mkdirSync(join(work, ".codex"), { recursive: true });
    writeFileSync(join(work, ".codex/config.toml"), "{{invalid toml");
    process.env.HOME = work;
    const code = runInstall("codex", []);
    expect(code).toBe(1);
  });

  it("append-if-missing appends to existing AGENTS.md", () => {
    mkdirSync(join(work, ".codex"), { recursive: true });
    writeFileSync(join(work, ".codex/AGENTS.md"), "# My Agent Notes\n");
    runInstall("codex", []);
    const content = readFileSync(join(work, ".codex/AGENTS.md"), "utf8");
    expect(content).toContain("# My Agent Notes");
    expect(content).toContain("<!-- dora:routing -->");
  });

  it("append-if-missing skips when marker already present", () => {
    mkdirSync(join(work, ".codex"), { recursive: true });
    const original = "# Agents\n\n<!-- dora:routing -->\n# dora\nold content\n";
    writeFileSync(join(work, ".codex/AGENTS.md"), original);
    runInstall("codex", []);
    const content = readFileSync(join(work, ".codex/AGENTS.md"), "utf8");
    expect(content).toBe(original);
  });

  it("append-if-missing adds blank line separator", () => {
    mkdirSync(join(work, ".codex"), { recursive: true });
    writeFileSync(join(work, ".codex/AGENTS.md"), "# Existing content");
    runInstall("codex", []);
    const content = readFileSync(join(work, ".codex/AGENTS.md"), "utf8");
    const idx = content.indexOf("<!-- dora:routing -->");
    expect(content.substring(idx - 2, idx)).toBe("\n\n");
  });
});
