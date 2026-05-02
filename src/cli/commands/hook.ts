import { claudeCode } from "@/platforms/claude-code";
import { codex } from "@/platforms/codex";
import { cursor } from "@/platforms/cursor";
import { opencode } from "@/platforms/opencode";
import type { PlatformAdapter } from "@/platforms/types";

const ADAPTERS: Record<string, PlatformAdapter> = { "claude-code": claudeCode, codex, cursor, opencode };

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(""));
    if (process.stdin.isTTY) resolve("");
  });
}

export async function runHook(platform: string, event: string): Promise<number> {
  const adapter = ADAPTERS[platform];
  if (!adapter) { process.stderr.write(`unknown platform: ${platform}\n`); return 64; }
  if (event !== "sessionstart") { process.stderr.write(`unknown event: ${event}\n`); return 64; }
  const stdin = await readStdin();
  let input: unknown = {};
  try { input = stdin ? JSON.parse(stdin) : {}; } catch {}
  process.stdout.write(JSON.stringify(adapter.sessionStartHook(input)));
  return 0;
}
