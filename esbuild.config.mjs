import { build } from "esbuild";
import { chmodSync } from "node:fs";

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

// sessionstart.mjs has no imports — copy directly
import { copyFileSync } from "node:fs";
copyFileSync("hooks/sessionstart.mjs", "hooks/sessionstart.bundle.mjs");
chmodSync("hooks/sessionstart.bundle.mjs", 0o755);

console.log("bundles written");
