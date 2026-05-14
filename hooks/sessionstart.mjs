import { readdirSync, statSync, rmSync } from "node:fs";
import { join } from "node:path";

const ROUTING = "You have access to dora — a tool that finds and loads community skills for tasks you don't already know how to do. When the user describes a non-trivial task and you're unsure which approach is best, call the dora_query MCP tool first.";

// Age-gated lazy cleanup of old plugin cache version dirs.
// Only delete dirs older than 1 hour to avoid breaking active sessions
// that still reference them. Pattern borrowed from context-mode (#181).
try {
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
  if (pluginRoot) {
    const m = pluginRoot.match(/^(.*[\\/]plugins[\\/]cache[\\/][^\\/]+[\\/][^\\/]+[\\/])/);
    if (m) {
      const cacheParent = m[1];
      const myDir = pluginRoot.replace(cacheParent, "").replace(/[\\/]/g, "");
      const ONE_HOUR = 3_600_000;
      const now = Date.now();
      for (const d of readdirSync(cacheParent)) {
        if (d === myDir) continue;
        try {
          const st = statSync(join(cacheParent, d));
          if (now - st.mtimeMs > ONE_HOUR) {
            rmSync(join(cacheParent, d), { recursive: true, force: true });
          }
        } catch { /* skip */ }
      }
    }
  }
} catch { /* best effort — never block session start */ }

process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: ROUTING }
}));
