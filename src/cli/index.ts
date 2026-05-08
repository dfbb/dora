import { startMcpServer } from "@/mcp/server";
import { handlers } from "@/mcp/tools";
import { isDoraError } from "@/core/errors";
import { execSync } from "node:child_process";

const argv = process.argv.slice(2);
const cmd = argv[0];

function killStaleMcpProcesses(): void {
  try {
    const self = process.pid;
    const scriptPath = process.argv[1];
    if (!scriptPath) return;
    const out: string = execSync("pgrep -x node 2>/dev/null || true", { encoding: "utf8" });
    for (const line of out.trim().split("\n")) {
      const pid = parseInt(line.trim(), 10);
      if (!pid || pid === self) continue;
      try {
        const cmdline: string = execSync(`ps -p ${pid} -o args=`, { encoding: "utf8" }).trim();
        if (cmdline.includes(scriptPath)) process.kill(pid, "SIGTERM");
      } catch { /* pid gone or no permission */ }
    }
  } catch { /* non-fatal */ }
}

async function main(): Promise<number> {
  switch (cmd) {
    case "mcp": {
      killStaleMcpProcesses();
      await startMcpServer();
      await new Promise<void>((resolve) => {
        process.once("SIGTERM", resolve);
        process.once("SIGINT", resolve);
      });
      return 0;
    }
    case "query": {
      const q = argv[1];
      if (!q) { process.stderr.write("usage: dora query <text>\n"); return 64; }
      process.stdout.write(await handlers.dora_query({ query: q }) + "\n");
      return 0;
    }
    case "load": {
      const [name, url, level] = argv.slice(1);
      if (!name || !url || !level) { process.stderr.write("usage: dora load <name> <repo_url> <security_level>\n"); return 64; }
      const out = await handlers.dora_load({ name, repo_url: url, security_level: level });
      process.stdout.write(out + "\n");
      return JSON.parse(out).error ? 5 : 0;
    }
    case "touch": {
      const key = argv[1];
      if (!key) { process.stderr.write("usage: dora touch <key>\n"); return 64; }
      const out = await handlers.dora_touch({ key });
      process.stdout.write(out + "\n");
      return JSON.parse(out).error ? 1 : 0;
    }
    case "list":
      process.stdout.write(await handlers.dora_list({}) + "\n"); return 0;
    case "stats":
      process.stdout.write(await handlers.dora_stats({}) + "\n"); return 0;
    case "doctor":
      process.stdout.write(await handlers.dora_doctor({}) + "\n"); return 0;
    case "upgrade":
      process.stdout.write(await handlers.dora_upgrade({}) + "\n"); return 0;
    case "purge": {
      const confirm = argv.includes("--yes") || argv.includes("-y");
      const out = await handlers.dora_purge({ confirm });
      process.stdout.write(out + "\n");
      return JSON.parse(out).error ? 1 : 0;
    }
    case "install": {
      const { runInstall } = await import("./commands/install");
      const { detectInstallTarget, INSTALL_TARGETS } = await import("@/platforms/detect");
      const platformArg = argv.slice(1).filter((a) => !a.startsWith("-"));
      const result = detectInstallTarget(platformArg, process.env);
      if (!result.ok) {
        switch (result.reason) {
          case "unsupported-install-target":
            process.stderr.write(`${result.hint}\n`);
            return 64;
          case "invalid-platform":
            process.stderr.write(`unknown platform: "${result.value}"\nsupported: ${INSTALL_TARGETS.join(", ")}\n`);
            return 64;
          case "no-signal":
            process.stderr.write(`no platform specified.\nusage: dora install <platform>\nsupported: ${INSTALL_TARGETS.join(", ")}\n`);
            return 64;
        }
      }
      return runInstall(result.target, argv.slice(2));
    }
    case "install:codex":
    case "install:cursor":
    case "install:opencode": {
      const { runInstall } = await import("./commands/install");
      return runInstall(cmd.replace("install:", ""), argv.slice(1));
    }
    case "hook": {
      const { runHook } = await import("./commands/hook");
      return runHook(argv[1] ?? "", argv[2] ?? "");
    }
    case "--version":
    case "-v":
      process.stdout.write("dora 0.1.0\n"); return 0;
    case "--help":
    case "-h":
    case undefined:
      process.stdout.write(USAGE); return 0;
    default:
      process.stderr.write(`unknown subcommand: ${cmd}\n`);
      process.stderr.write(USAGE);
      return 64;
  }
}

const USAGE = `dora <subcommand>

  query <text>                    Search skill engine
  load <name> <url> <level>       Clone and cache a skill
  touch <key>                     Mark cached skill used
  list                            List cached skills
  stats                           Usage stats
  doctor                          Diagnostics
  upgrade                         Upgrade dora
  purge --yes                     Wipe all cached skills
  mcp                             Start MCP stdio server
  install [platform]              Write platform config (auto-detect if omitted)
  install:<platform>              Write platform config
  hook <platform> <event>         Run platform hook
`;

main().then((code) => process.exit(code)).catch((e) => {
  if (isDoraError(e)) process.stderr.write(`[dora] ${e.code}: ${e.message}\n`);
  else process.stderr.write(`[dora] ${(e as Error).stack ?? e}\n`);
  process.exit(1);
});
