import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, DEFAULTS } from "@/core/config";

let work: string;
const orig = { ...process.env };

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), "dora-config-"));
  process.env.DORA_HOME = work;
});
afterEach(() => {
  process.env = { ...orig };
  rmSync(work, { recursive: true, force: true });
});

describe("loadConfig", () => {
  it("returns DEFAULTS when no config.yaml", () => {
    expect(loadConfig()).toEqual(DEFAULTS);
  });
  it("merges user config with defaults", () => {
    writeFileSync(join(work, "config.yaml"), "min_security_level: warn\ntop_k: 10\n");
    const cfg = loadConfig();
    expect(cfg.min_security_level).toBe("warn");
    expect(cfg.top_k).toBe(10);
    expect(cfg.skill_query_url).toBe(DEFAULTS.skill_query_url);
  });
  it("rejects invalid security level", () => {
    writeFileSync(join(work, "config.yaml"), "min_security_level: yolo\n");
    expect(() => loadConfig()).toThrow();
  });
  it("rejects negative top_k", () => {
    writeFileSync(join(work, "config.yaml"), "top_k: -1\n");
    expect(() => loadConfig()).toThrow();
  });
});
