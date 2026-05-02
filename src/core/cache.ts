import { existsSync, readdirSync, rmSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { DoraError, ERR } from "./errors";
import { queryLogPath, skillsDir } from "./paths";
import { ensureConsistent, writeStatus } from "./status";

export function touch(key: string): void {
  const status = ensureConsistent();
  const entry = status.skills[key];
  if (!entry) throw new DoraError(ERR.VALIDATION, `unknown key: ${key}`);
  entry.last_used_at = new Date().toISOString();
  entry.use_count = (entry.use_count ?? 0) + 1;
  writeStatus(status);
}

export interface SkillRow {
  key: string;
  use_count: number;
  age_days: number | null;
  security_level: string;
  status: "ok" | "broken" | "orphan";
}

export function listSkills(): SkillRow[] {
  const status = ensureConsistent();
  const dir = skillsDir();
  const onDisk = existsSync(dir)
    ? readdirSync(dir).filter((f) => f.includes("_") && statSync(join(dir, f)).isDirectory())
    : [];
  const indexed = new Set(Object.keys(status.skills));
  const orphans = onDisk.filter((d) => !indexed.has(d)).sort();
  const now = Date.now();
  const rows: SkillRow[] = [];
  for (const key of Object.keys(status.skills).sort()) {
    const e = status.skills[key]!;
    const last = Date.parse(e.last_used_at);
    const age = isNaN(last) ? null : Math.floor((now - last) / 86_400_000);
    const broken = !existsSync(join(dir, key)) || !e.primary_skill_path || !existsSync(join(dir, key, e.primary_skill_path));
    rows.push({ key, use_count: e.use_count ?? 0, age_days: age, security_level: e.security_level, status: broken ? "broken" : "ok" });
  }
  for (const key of orphans) {
    rows.push({ key, use_count: 0, age_days: null, security_level: "?", status: "orphan" });
  }
  return rows;
}

export interface PurgeResult {
  deleted_skills: number;
  deleted_query_log: boolean;
}

export function purgeAll(): PurgeResult {
  const dir = skillsDir();
  let deleted = 0;
  if (existsSync(dir)) {
    for (const child of readdirSync(dir)) {
      const full = join(dir, child);
      if (statSync(full).isDirectory() && child.includes("_")) {
        rmSync(full, { recursive: true, force: true });
        deleted++;
      }
    }
  }
  writeStatus({ version: 1, skills: {} });
  const log = queryLogPath();
  const removedLog = existsSync(log);
  if (removedLog) unlinkSync(log);
  return { deleted_skills: deleted, deleted_query_log: removedLog };
}
