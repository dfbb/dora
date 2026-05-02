import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadStatus, writeStatus, ensureConsistent } from "@/core/status";
import type { Status } from "@/core/types";

let work: string;
const orig = { ...process.env };

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), "dora-status-"));
  process.env.DORA_HOME = work;
});
afterEach(() => {
  process.env = { ...orig };
  rmSync(work, { recursive: true, force: true });
});

const sample: Status = {
  version: 1,
  skills: {
    "foo_alice": {
      skill_name: "foo",
      owner: "alice",
      repo_url: "https://github.com/alice/foo",
      github_hash: "abc",
      primary_skill_path: "SKILL.md",
      security_level: "safe",
      downloaded_at: "2026-05-02T00:00:00Z",
      last_used_at: "2026-05-02T00:00:00Z",
      use_count: 1,
    },
  },
};

describe("status atomic IO", () => {
  it("loadStatus returns empty when missing", () => {
    expect(loadStatus()).toEqual({ version: 1, skills: {} });
  });
  it("writeStatus then loadStatus round-trips", () => {
    writeStatus(sample);
    expect(loadStatus()).toEqual(sample);
  });
  it("writeStatus is atomic — partial files cleaned up", () => {
    writeStatus(sample);
    const skillsPath = join(work, "skills");
    const stragglers = readdirSync(skillsPath).filter((f: string) => f.startsWith(".status."));
    expect(stragglers).toHaveLength(0);
  });
  it("loadStatus throws on malformed yaml", () => {
    mkdirSync(join(work, "skills"));
    writeFileSync(join(work, "skills", "status.yaml"), "not: a\n  status: file\n");
    expect(() => loadStatus()).toThrow();
  });
});

describe("ensureConsistent", () => {
  it("returns existing valid status untouched", () => {
    writeStatus(sample);
    expect(ensureConsistent()).toEqual(sample);
  });
  it("backs up corrupt file and returns empty", () => {
    mkdirSync(join(work, "skills"));
    writeFileSync(join(work, "skills", "status.yaml"), "garbage: [unclosed\n");
    const out = ensureConsistent();
    expect(out).toEqual({ version: 1, skills: {} });
    const backups = readdirSync(join(work, "skills"))
      .filter((f: string) => f.startsWith("status.yaml.bak."));
    expect(backups.length).toBeGreaterThan(0);
  });
  it("returns empty when missing", () => {
    expect(ensureConsistent()).toEqual({ version: 1, skills: {} });
  });
});
