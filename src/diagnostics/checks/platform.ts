import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { CheckResult } from "../run";

function detectPlatform(): "claude-code" | "codex" | "cursor" | "opencode" | "unknown" {
  if (process.env.CLAUDE_PLUGIN_ROOT) return "claude-code";
  if (existsSync(join(homedir(), ".codex", "config.toml"))) return "codex";
  if (existsSync(".cursor/mcp.json") || existsSync(join(homedir(), ".cursor/mcp.json"))) return "cursor";
  if (existsSync("opencode.json") || existsSync(join(homedir(), ".config/opencode/opencode.json"))) return "opencode";
  return "unknown";
}

function detectMcp(p: string): boolean {
  if (p === "claude-code") return true;
  if (p === "codex") {
    try { return readFileSync(join(homedir(), ".codex", "config.toml"), "utf8").includes("[mcp_servers.dora]"); } catch { return false; }
  }
  if (p === "cursor") {
    for (const f of [".cursor/mcp.json", join(homedir(), ".cursor/mcp.json")]) {
      try { if (readFileSync(f, "utf8").includes('"dora"')) return true; } catch {}
    }
    return false;
  }
  if (p === "opencode") {
    for (const f of ["opencode.json", join(homedir(), ".config/opencode/opencode.json")]) {
      try { if (readFileSync(f, "utf8").includes('"dora"')) return true; } catch {}
    }
    return false;
  }
  return false;
}

function detectHook(p: string): boolean {
  if (p === "claude-code") return true;
  if (p === "codex") {
    try { return readFileSync(join(homedir(), ".codex", "hooks.json"), "utf8").includes("dora hook codex"); } catch { return false; }
  }
  return false;
}

export async function checkPlatform(): Promise<{ mcp: CheckResult; hook: CheckResult }> {
  const platform = detectPlatform();
  if (platform === "unknown") {
    return {
      mcp: { name: "MCP server registered", status: "warn", detail: "no platform detected" },
      hook: { name: "SessionStart hook installed", status: "warn", detail: "no platform detected" },
    };
  }
  return {
    mcp: { name: `MCP server registered (${platform})`, status: detectMcp(platform) ? "pass" : "fail" },
    hook: { name: `SessionStart hook installed (${platform})`, status: detectHook(platform) ? "pass" : "warn", detail: detectHook(platform) ? undefined : "optional on this platform" },
  };
}
