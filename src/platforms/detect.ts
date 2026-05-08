export type PlatformId =
  | "claude-code"
  | "codex"
  | "opencode"
  | "gemini-cli"
  | "qwen-code"
  | "unknown";

export interface DetectionResult {
  platform: PlatformId;
  source: "env-override" | "clientInfo" | "env-signal" | "fallback";
  warning?: string;
}

const VALID_PLATFORMS = new Set<string>([
  "claude-code", "codex", "opencode",
  "gemini-cli", "qwen-code",
]);

interface ClientInfo {
  name?: string;
}

const CLIENT_NAME_MAP: Record<string, PlatformId> = {
  "claude-code": "claude-code",
  codex: "codex",
  "codex-mcp-client": "codex",
  "gemini-cli-mcp-client": "gemini-cli",
  "qwen-code": "qwen-code",
};

const ENV_SIGNAL_MAP: Array<{ env: string; platform: PlatformId }> = [
  { env: "CLAUDE_PROJECT_DIR", platform: "claude-code" },
  { env: "CLAUDE_SESSION_ID", platform: "claude-code" },
  { env: "CODEX_THREAD_ID", platform: "codex" },
  { env: "CODEX_CI", platform: "codex" },
  { env: "OPENCODE", platform: "opencode" },
  { env: "OPENCODE_PID", platform: "opencode" },
  { env: "GEMINI_PROJECT_DIR", platform: "gemini-cli" },
  { env: "GEMINI_CLI", platform: "gemini-cli" },
  { env: "QWEN_PROJECT_DIR", platform: "qwen-code" },
];

export function detectRuntimePlatform(
  clientInfo: ClientInfo | undefined,
  env: Record<string, string | undefined>,
): DetectionResult {
  // 1. DORA_PLATFORM env override (highest priority)
  const override = env["DORA_PLATFORM"];
  if (override) {
    if (VALID_PLATFORMS.has(override)) {
      return { platform: override as PlatformId, source: "env-override" };
    }
    return {
      platform: "unknown",
      source: "env-override",
      warning: `invalid DORA_PLATFORM value: "${override}"`,
    };
  }

  // 2. MCP clientInfo.name (case-insensitive)
  if (clientInfo?.name) {
    const lower = clientInfo.name.toLowerCase();
    const direct = CLIENT_NAME_MAP[lower];
    if (direct) return { platform: direct, source: "clientInfo" };
    // Qwen prefix match
    if (lower.startsWith("qwen-cli-mcp-client")) {
      return { platform: "qwen-code", source: "clientInfo" };
    }
  }

  // 3. Environment variable signals
  for (const { env: key, platform } of ENV_SIGNAL_MAP) {
    if (env[key]) return { platform, source: "env-signal" };
  }

  // 4. Fallback
  return { platform: "unknown", source: "fallback" };
}

export const INSTALL_TARGETS = [
  "codex", "opencode", "gemini-cli", "qwen-code",
] as const;

export type InstallTarget = typeof INSTALL_TARGETS[number];

export type InstallDetectionResult =
  | { ok: true; target: InstallTarget }
  | { ok: false; reason: "unsupported-install-target"; platform: PlatformId; hint: string }
  | { ok: false; reason: "invalid-platform"; value: string }
  | { ok: false; reason: "no-signal" };

const INSTALL_SET = new Set<string>(INSTALL_TARGETS);
const CLAUDE_CODE_HINT = "Claude Code uses plugin marketplace. Run: /plugin marketplace add dfbb/dora && /plugin install dora@dora";

export function detectInstallTarget(
  argv: string[],
  env: Record<string, string | undefined>,
): InstallDetectionResult {
  // 1. Explicit argument
  const explicit = argv[0];
  if (explicit) {
    if (explicit === "claude-code") {
      return { ok: false, reason: "unsupported-install-target", platform: "claude-code", hint: CLAUDE_CODE_HINT };
    }
    if (INSTALL_SET.has(explicit)) {
      return { ok: true, target: explicit as InstallTarget };
    }
    return { ok: false, reason: "invalid-platform", value: explicit };
  }

  // 2. DORA_PLATFORM env
  const override = env.DORA_PLATFORM;
  if (override) {
    if (override === "claude-code") {
      return { ok: false, reason: "unsupported-install-target", platform: "claude-code", hint: CLAUDE_CODE_HINT };
    }
    if (INSTALL_SET.has(override)) {
      return { ok: true, target: override as InstallTarget };
    }
    return { ok: false, reason: "invalid-platform", value: override };
  }

  // 3. Env signals (reuse ENV_SIGNAL_MAP but filter to installable targets)
  for (const { env: key, platform } of ENV_SIGNAL_MAP) {
    if (!env[key]) continue;
    if (platform === "claude-code") {
      return { ok: false, reason: "unsupported-install-target", platform: "claude-code", hint: CLAUDE_CODE_HINT };
    }
    if (INSTALL_SET.has(platform)) {
      return { ok: true, target: platform as InstallTarget };
    }
  }

  // 4. No signal
  return { ok: false, reason: "no-signal" };
}
