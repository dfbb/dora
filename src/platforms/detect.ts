export type PlatformId =
  | "claude-code"
  | "codex"
  | "openclaw"
  | "opencode"
  | "gemini-cli"
  | "qwen-code"
  | "cursor"
  | "unknown";

export interface DetectionResult {
  platform: PlatformId;
  source: "env-override" | "clientInfo" | "env-signal" | "fallback";
  warning?: string;
}

const VALID_PLATFORMS = new Set<string>([
  "claude-code", "codex", "openclaw", "opencode",
  "gemini-cli", "qwen-code", "cursor",
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
