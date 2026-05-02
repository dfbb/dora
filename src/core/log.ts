import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { queryLogPath, resolveDoraHome } from "./paths";

const MAX_LINES = 1000;

export interface QueryLogEntry {
  timestamp: string;
  query: string;
  candidate_count: number;
}

export function appendQueryLog(input: { query: string; candidate_count: number }): void {
  mkdirSync(resolveDoraHome(), { recursive: true });
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    query: input.query,
    candidate_count: input.candidate_count,
  }) + "\n";
  const p = queryLogPath();
  appendFileSync(p, line, "utf8");
  rollIfNeeded(p);
}

function rollIfNeeded(p: string): void {
  const raw = readFileSync(p, "utf8");
  const lines = raw.split("\n").filter((l) => l.length > 0);
  if (lines.length > MAX_LINES) {
    const kept = lines.slice(lines.length - MAX_LINES);
    writeFileSync(p, kept.join("\n") + "\n", "utf8");
  }
}

export function readRecentQueryLog(n: number): QueryLogEntry[] {
  const p = queryLogPath();
  if (!existsSync(p)) return [];
  const lines = readFileSync(p, "utf8").split("\n").filter((l) => l.length > 0);
  const tail = lines.slice(Math.max(0, lines.length - n));
  return tail
    .map((l) => {
      try { return JSON.parse(l) as QueryLogEntry; } catch { return null; }
    })
    .filter((x): x is QueryLogEntry => x !== null);
}
