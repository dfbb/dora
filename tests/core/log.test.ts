import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendQueryLog, readRecentQueryLog } from "@/core/log";

let work: string;
const orig = { ...process.env };

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), "dora-log-"));
  process.env.DORA_HOME = work;
});
afterEach(() => {
  process.env = { ...orig };
  rmSync(work, { recursive: true, force: true });
});

describe("query log", () => {
  it("appendQueryLog writes a line; readRecentQueryLog returns it", () => {
    appendQueryLog({ query: "x", candidate_count: 3 });
    const rows = readRecentQueryLog(50);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.query).toBe("x");
    expect(rows[0]!.candidate_count).toBe(3);
    expect(typeof rows[0]!.timestamp).toBe("string");
  });
  it("rolls over at 1000 lines, keeping last 1000", () => {
    for (let i = 0; i < 1100; i++) {
      appendQueryLog({ query: `q${i}`, candidate_count: i });
    }
    const rows = readRecentQueryLog(2000);
    expect(rows).toHaveLength(1000);
    expect(rows[0]!.query).toBe("q100");
    expect(rows[999]!.query).toBe("q1099");
  });
  it("readRecentQueryLog returns [] when file missing", () => {
    expect(readRecentQueryLog(50)).toEqual([]);
  });
});
