import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";
import { parse, stringify } from "yaml";
import { skillsDir, statusPath } from "./paths";
import type { Status } from "./types";
import { DoraError, ERR } from "./errors";

export function loadStatus(): Status {
  const p = statusPath();
  if (!existsSync(p)) return { version: 1, skills: {} };
  const raw = readFileSync(p, "utf8");
  let data: unknown;
  try {
    data = parse(raw);
  } catch (e) {
    throw new DoraError(ERR.STATUS_CORRUPT, `status.yaml parse error: ${(e as Error).message}`);
  }
  if (!data || typeof data !== "object" || !("skills" in data)) {
    throw new DoraError(ERR.STATUS_CORRUPT, "status.yaml malformed");
  }
  const obj = data as Status;
  obj.version = obj.version ?? 1;
  obj.skills = obj.skills ?? {};
  return obj;
}

export function writeStatus(data: Status): void {
  const p = statusPath();
  mkdirSync(dirname(p), { recursive: true });
  const tmp = `${dirname(p)}/.status.${process.pid}.${Date.now()}.tmp`;
  try {
    writeFileSync(tmp, stringify(data, { sortMapEntries: false }), "utf8");
    renameSync(tmp, p);
  } catch (e) {
    if (existsSync(tmp)) {
      try { unlinkSync(tmp); } catch {}
    }
    throw e;
  }
}

export function ensureConsistent(): Status {
  const p = statusPath();
  if (existsSync(p)) {
    try {
      return loadStatus();
    } catch {
      const ts = new Date().toISOString().replace(/[:.]/g, "").replace(/-/g, "");
      const backup = `${p}.bak.${ts}`;
      renameSync(p, backup);
    }
  }
  const empty: Status = { version: 1, skills: {} };
  mkdirSync(skillsDir(), { recursive: true });
  writeStatus(empty);
  return empty;
}
