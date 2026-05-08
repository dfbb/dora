import { build } from "esbuild";
import { chmodSync, readFileSync, writeFileSync } from "node:fs";

// Sync version from package.json into plugin manifests
const { version } = JSON.parse(readFileSync("package.json", "utf8"));
for (const path of [".claude-plugin/marketplace.json", ".claude-plugin/plugin.json"]) {
  const text = readFileSync(path, "utf8");
  writeFileSync(path, text.replace(/"version": "[^"]*"/g, `"version": "${version}"`));
}

const SHARED = {
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node18",
  external: ["yaml", "zod"],
  minify: false,
  sourcemap: false,
  banner: { js: "#!/usr/bin/env node" },
  alias: { "@": "./src" },
  loader: { ".gz": "binary" },
};

await build({
  ...SHARED,
  entryPoints: ["src/cli/index.ts"],
  outfile: "cli.bundle.mjs",
});
chmodSync("cli.bundle.mjs", 0o755);

await build({
  ...SHARED,
  entryPoints: ["src/mcp/start.ts"],
  outfile: "start.bundle.mjs",
});
chmodSync("start.bundle.mjs", 0o755);

await build({
  ...SHARED,
  entryPoints: ["hooks/sessionstart.mjs"],
  outfile: "hooks/sessionstart.bundle.mjs",
  external: [],
});
chmodSync("hooks/sessionstart.bundle.mjs", 0o755);

console.log("bundles written");
