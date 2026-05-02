import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import { readFileSync } from "node:fs";
import { writeStatus } from "@/core/status";
import { touch, listSkills, purgeAll } from "@/core/cache";
import { DoraError } from "@/core/errors";
import type { Status } from "@/core/types";

let work: string;
const orig = { ...process.env };

const sample = (): Status => ({
  version: 1,
  skills: {
    "foo_alice": {
      skill_name: "foo", owner: "alice",
      repo_url: "https://github.com/alice/foo",
      github_hash: "a", primary_skill_path: "SKILL.md",
      security_level: "safe",
      downloaded_at: "2026-05-01T00:00:00Z",
      last_used_at: "2026-05-01T00:00:00Z",
      use_count: 0,
    },
  },
});

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), "dora-cache-"));
  process.env.DORA_HOME = work;
  mkdirSync(join(work, "skills", "foo_alice"), { recursive: true });
  writeFileSync(join(work, "skills", "foo_alice", "SKILL.md"), "# foo");
  writeStatus(sample());
});
afterEach(() => {
  process.env = { ...orig };
  rmSync(work, { recursive: true, force: true });
});

describe("touch", () => {
  it("increments use_count and updates last_used_at", () => {
    const before = sample().skills["foo_alice"]!.last_used_at;
    touch("foo_alice");
    const raw = readFileSync(join(work, "skills", "status.yaml"), "utf8");
    const { skills } = parse(raw) as { skills: Record<string, { use_count: number; last_used_at: string }> };
    expect(skills["foo_alice"]!.use_count).toBe(1);
    expect(skills["foo_alice"]!.last_used_at).not.toBe(before);
  });
  it("throws DoraError on unknown key", () => {
    expect(() => touch("unknown_x")).toThrow(DoraError);
  });
});

describe("listSkills", () => {
  it("returns rows sorted by key", () => {
    const rows = listSkills();
    expect(rows.length).toBe(1);
    expect(rows[0]!.key).toBe("foo_alice");
    expect(rows[0]!.status).toBe("ok");
  });
  it("flags broken when SKILL.md missing", () => {
    rmSync(join(work, "skills", "foo_alice", "SKILL.md"));
    const rows = listSkills();
    expect(rows[0]!.status).toBe("broken");
  });
  it("includes orphan dirs not in status", () => {
    mkdirSync(join(work, "skills", "ghost_bob"));
    const rows = listSkills();
    expect(rows.find((r) => r.key === "ghost_bob")?.status).toBe("orphan");
  });
});

describe("purgeAll", () => {
  it("deletes all skill dirs and resets status.yaml, preserves config.yaml", () => {
    writeFileSync(join(work, "query-log.jsonl"), "{}\n");
    writeFileSync(join(work, "config.yaml"), "min_security_level: warn\n");
    const r = purgeAll();
    expect(existsSync(join(work, "skills", "foo_alice"))).toBe(false);
    expect(existsSync(join(work, "query-log.jsonl"))).toBe(false);
    expect(existsSync(join(work, "config.yaml"))).toBe(true);
    expect(r.deleted_skills).toBe(1);
  });
});
