import { existsSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export function resolveDoraHome(): string {
  const env = process.env.DORA_HOME;
  if (env && env.length > 0) return env;
  const cwd = realpathSync(process.cwd());
  if (existsSync(join(cwd, ".dora")) || existsSync(join(cwd, "node_modules", "dora"))) {
    return join(cwd, ".dora");
  }
  return join(homedir(), ".dora");
}

export function skillsDir(): string {
  return join(resolveDoraHome(), "skills");
}

export function statusPath(): string {
  return join(skillsDir(), "status.yaml");
}

export function configPath(): string {
  return join(resolveDoraHome(), "config.yaml");
}

export function queryLogPath(): string {
  return join(resolveDoraHome(), "query-log.jsonl");
}
