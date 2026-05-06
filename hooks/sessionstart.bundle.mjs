#!/usr/bin/env node
#!/usr/bin/env node

// hooks/sessionstart.mjs
import { readdirSync, statSync, rmSync } from "node:fs";
import { join } from "node:path";
var ROUTING = "You have access to dora \u2014 a tool that finds and loads community skills for tasks you don't already know how to do. When the user describes a non-trivial task and you're unsure which approach is best, call the dora_query MCP tool first.";
try {
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
  if (pluginRoot) {
    const m = pluginRoot.match(/^(.*[\\/]plugins[\\/]cache[\\/][^\\/]+[\\/][^\\/]+[\\/])/);
    if (m) {
      const cacheParent = m[1];
      const myDir = pluginRoot.replace(cacheParent, "").replace(/[\\/]/g, "");
      const ONE_HOUR = 36e5;
      const now = Date.now();
      for (const d of readdirSync(cacheParent)) {
        if (d === myDir) continue;
        try {
          const st = statSync(join(cacheParent, d));
          if (now - st.mtimeMs > ONE_HOUR) {
            rmSync(join(cacheParent, d), { recursive: true, force: true });
          }
        } catch {
        }
      }
    }
  }
} catch {
}
process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: ROUTING }
}));
