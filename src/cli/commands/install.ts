import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";
import { codex } from "@/platforms/codex";
import { cursor } from "@/platforms/cursor";
import { opencode } from "@/platforms/opencode";
import { geminiCli } from "@/platforms/gemini-cli";
import { openClaw } from "@/platforms/openclaw";
import { qwenCode } from "@/platforms/qwen-code";
import type { PlatformAdapter } from "@/platforms/types";

const ADAPTERS: Record<string, PlatformAdapter> = {
  codex, cursor, opencode,
  "gemini-cli": geminiCli,
  openclaw: openClaw,
  "qwen-code": qwenCode,
};

function expandTilde(p: string): string {
  return p.startsWith("~/") ? join(homedir(), p.slice(2)) : p;
}

function deepMerge(existing: unknown, incoming: unknown): unknown {
  if (typeof existing !== "object" || existing === null || Array.isArray(existing)) return incoming;
  if (typeof incoming !== "object" || incoming === null || Array.isArray(incoming)) return incoming;
  const out: Record<string, unknown> = { ...(existing as Record<string, unknown>) };
  for (const [k, v] of Object.entries(incoming as Record<string, unknown>)) {
    out[k] = deepMerge(out[k], v);
  }
  return out;
}

function writeSafe(path: string, content: string, atomic: boolean): void {
  if (atomic) {
    const tmp = path + ".tmp." + process.pid;
    writeFileSync(tmp, content, "utf8");
    renameSync(tmp, path);
  } else {
    writeFileSync(path, content, "utf8");
  }
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

    if (f.mode === "append-if-missing" && existsSync(target)) {
      const existing = readFileSync(target, "utf8");
      const marker = f.marker ?? f.content.trim();
      if (existing.includes(marker)) {
        process.stdout.write(`skip (present): ${target}\n`); continue;
      }
      const appended = existing.trimEnd() + "\n\n" + f.content + "\n";
      if (f.backup) copyFileSync(target, target + ".bak");
      writeSafe(target, appended, f.atomic ?? false);
      process.stdout.write(`appended: ${target}\n`); continue;
    }

    if (f.mode === "json-merge" && existsSync(target)) {
      if (f.backup) copyFileSync(target, target + ".bak");
      let existing: unknown;
      try {
        existing = JSON.parse(readFileSync(target, "utf8"));
      } catch {
        process.stderr.write(`error: ${target} has invalid JSON, not overwriting\n`);
        return 1;
      }
      const incoming = JSON.parse(f.content);
      writeSafe(target, JSON.stringify(deepMerge(existing, incoming), null, 2) + "\n", f.atomic ?? false);
      process.stdout.write(`wrote: ${target}\n`); continue;
    }

    if (f.mode === "toml-merge" && existsSync(target)) {
      if (f.backup) copyFileSync(target, target + ".bak");
      try {
        const existing = parseToml(readFileSync(target, "utf8"));
        const incoming = parseToml(f.content);
        writeSafe(target, stringifyToml(deepMerge(existing, incoming) as Parameters<typeof stringifyToml>[0]), f.atomic ?? false);
      } catch (e) {
        process.stderr.write(`error: ${target} has invalid TOML or merge failed: ${(e as Error).message}\n`);
        return 1;
      }
      process.stdout.write(`wrote: ${target}\n`); continue;
    }

    if (f.backup && existsSync(target)) copyFileSync(target, target + ".bak");
    writeSafe(target, f.content, f.atomic ?? false);
    process.stdout.write(`wrote: ${target}\n`);
  }
  return 0;
}
