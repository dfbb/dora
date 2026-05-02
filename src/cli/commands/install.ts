import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { codex } from "@/platforms/codex";
import { cursor } from "@/platforms/cursor";
import { opencode } from "@/platforms/opencode";
import type { PlatformAdapter } from "@/platforms/types";

const ADAPTERS: Record<string, PlatformAdapter> = { codex, cursor, opencode };

function expandTilde(p: string): string {
  return p.startsWith("~/") ? join(homedir(), p.slice(2)) : p;
}

function shallowMergeJson(existing: unknown, incoming: unknown): unknown {
  if (typeof existing !== "object" || existing === null) return incoming;
  if (typeof incoming !== "object" || incoming === null) return incoming;
  const out: Record<string, unknown> = { ...(existing as object) };
  for (const [k, v] of Object.entries(incoming as object)) {
    if (typeof v === "object" && v !== null && typeof (out as Record<string, unknown>)[k] === "object") {
      out[k] = { ...(out[k] as object), ...(v as object) };
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function runInstall(platform: string, argv: string[]): number {
  const adapter = ADAPTERS[platform];
  if (!adapter) { process.stderr.write(`unknown platform: ${platform}\n`); return 64; }
  const dryRun = argv.includes("--dry-run");
  for (const f of adapter.installFiles()) {
    const target = expandTilde(f.path);
    if (dryRun) { process.stdout.write(`[dry-run] ${f.mode}: ${target}\n`); continue; }
    mkdirSync(dirname(target), { recursive: true });
    if (f.mode === "skip-if-exists" && existsSync(target)) {
      process.stdout.write(`skip (exists): ${target}\n`); continue;
    }
    if (f.mode === "json-merge" && existsSync(target)) {
      const existing = JSON.parse(readFileSync(target, "utf8"));
      const incoming = JSON.parse(f.content);
      writeFileSync(target, JSON.stringify(shallowMergeJson(existing, incoming), null, 2) + "\n", "utf8");
    } else {
      writeFileSync(target, f.content, "utf8");
    }
    process.stdout.write(`wrote: ${target}\n`);
  }
  return 0;
}
