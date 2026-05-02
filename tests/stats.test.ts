import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeStatus } from "@/core/status";
import { appendQueryLog } from "@/core/log";
import { buildStats } from "@/stats";

let work: string;
const orig = { ...process.env };

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), "dora-stats-"));
  process.env.DORA_HOME = work;
});
afterEach(() => {
  process.env = { ...orig };
  rmSync(work, { recursive: true, force: true });
});

describe("buildStats", () => {
  it("returns 'no skills' message when empty", () => {
    const md = buildStats();
    expect(md).toMatch(/Total cached:\s*0/);
  });

  it("includes top by use_count, last_7d count, avg candidates", () => {
    mkdirSync(join(work, "skills", "foo_alice"), { recursive: true });
    writeFileSync(join(work, "skills", "foo_alice", "SKILL.md"), "# foo");
    const recent = new Date().toISOString();
    writeStatus({
      version: 1,
      skills: {
        "foo_alice": {
          skill_name: "foo", owner: "alice",
          repo_url: "https://github.com/a/foo",
          github_hash: "x", primary_skill_path: "SKILL.md",
          security_level: "safe",
          downloaded_at: recent, last_used_at: recent, use_count: 7,
        },
      },
    });
    appendQueryLog({ query: "q1", candidate_count: 3 });
    appendQueryLog({ query: "q2", candidate_count: 5 });

    const md = buildStats();
    expect(md).toMatch(/Total cached:\s*1/);
    expect(md).toMatch(/foo_alice/);
    expect(md).toMatch(/uses:\s*7|7\s*\|/);
    expect(md).toMatch(/last 7d:\s*1/);
    expect(md).toMatch(/Avg candidates per query:\s*4\.0/);
  });
});
