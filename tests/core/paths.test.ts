import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, realpathSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join } from "node:path";
import { resolveDoraHome, skillsDir, statusPath, configPath, queryLogPath } from "@/core/paths";

let work: string;
const origEnv = { ...process.env };
const origCwd = process.cwd();

beforeEach(() => {
  work = realpathSync(mkdtempSync(join(tmpdir(), "dora-paths-")));
  delete process.env.DORA_HOME;
});
afterEach(() => {
  process.chdir(origCwd);
  process.env = { ...origEnv };
  rmSync(work, { recursive: true, force: true });
});

describe("resolveDoraHome", () => {
  it("uses DORA_HOME env when set", () => {
    process.env.DORA_HOME = work;
    expect(resolveDoraHome()).toBe(work);
  });
  it("uses cwd/.dora when .dora dir exists", () => {
    mkdirSync(join(work, ".dora"));
    process.chdir(work);
    expect(resolveDoraHome()).toBe(join(work, ".dora"));
  });
  it("uses cwd/.dora when node_modules/dora exists", () => {
    mkdirSync(join(work, "node_modules", "dora"), { recursive: true });
    process.chdir(work);
    expect(resolveDoraHome()).toBe(join(work, ".dora"));
  });
  it("falls back to ~/.dora", () => {
    process.chdir(work);
    expect(resolveDoraHome()).toBe(join(homedir(), ".dora"));
  });
  it("env takes precedence over cwd", () => {
    process.env.DORA_HOME = "/explicit";
    mkdirSync(join(work, ".dora"));
    process.chdir(work);
    expect(resolveDoraHome()).toBe("/explicit");
  });
});

describe("derived paths", () => {
  it("skillsDir returns <home>/skills", () => {
    process.env.DORA_HOME = work;
    expect(skillsDir()).toBe(join(work, "skills"));
  });
  it("statusPath returns <home>/skills/status.yaml", () => {
    process.env.DORA_HOME = work;
    expect(statusPath()).toBe(join(work, "skills", "status.yaml"));
  });
  it("configPath returns <home>/config.yaml", () => {
    process.env.DORA_HOME = work;
    expect(configPath()).toBe(join(work, "config.yaml"));
  });
  it("queryLogPath returns <home>/query-log.jsonl", () => {
    process.env.DORA_HOME = work;
    expect(queryLogPath()).toBe(join(work, "query-log.jsonl"));
  });
});
