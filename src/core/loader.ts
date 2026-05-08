import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { loadConfig } from "./config";
import { DoraError, ERR } from "./errors";
import { gitClone, gitRevParse } from "./git";
import { skillsDir } from "./paths";
import { ensureConsistent, writeStatus } from "./status";
import type { SecurityLevel } from "./types";
import { makeKey, parseRepoUrl, validateName } from "./validate";

export interface LoadInput {
  name: string;
  repoUrl: string;
  securityLevel: SecurityLevel;
}

export interface LoadOutput {
  key: string;
  skill_md_path: string;
  cache_hit: boolean;
}

export async function loadSkill(input: LoadInput): Promise<LoadOutput> {
  validateName(input.name);

  const isTest = process.env.DORA_TEST === "1" && input.repoUrl.startsWith("file://");
  let owner: string;
  let cloneUrl: string;
  let subPath: string | undefined;
  if (isTest) {
    owner = "local";
    cloneUrl = input.repoUrl;
  } else {
    const parsed = parseRepoUrl(input.repoUrl);
    owner = parsed.owner;
    cloneUrl = parsed.cloneUrl;
    subPath = parsed.subPath;
  }

  const key = makeKey(input.name, owner);
  const cfg = loadConfig();
  const dir = skillsDir();
  mkdirSync(dir, { recursive: true });
  const status = ensureConsistent();
  const existing = status.skills[key];

  if (existing && existing.repo_url === input.repoUrl) {
    const last = Date.parse(existing.last_used_at);
    const ageMs = Date.now() - last;
    const ttlMs = cfg.cache_ttl_days * 86_400_000;
    const within = isFinite(ageMs) && ageMs < ttlMs;
    const primaryAbs = join(dir, key, existing.primary_skill_path);
    if (within && existsSync(primaryAbs)) {
      return { key, skill_md_path: resolve(primaryAbs), cache_hit: true };
    }
  }

  const target = join(dir, key);
  const tmp = join(dir, `tmp_${key}`);
  if (existsSync(tmp)) rmSync(tmp, { recursive: true, force: true });

  gitClone(cloneUrl, tmp);

  const primary = findPrimarySkillMd(tmp, input.name, subPath);
  if (!primary) {
    rmSync(tmp, { recursive: true, force: true });
    throw new DoraError(ERR.NO_SKILL_MD, "repo contains no SKILL.md", { repoUrl: input.repoUrl });
  }

  const primaryRel = relative(tmp, primary);
  if (existsSync(target)) rmSync(target, { recursive: true, force: true });
  renameSync(tmp, target);

  let head = "";
  try { head = gitRevParse(target, "HEAD"); } catch {}
  const now = new Date().toISOString();
  const sameUrl = existing && existing.repo_url === input.repoUrl;
  const priorCount = sameUrl ? existing!.use_count : 0;

  status.skills[key] = {
    skill_name: input.name,
    owner,
    repo_url: input.repoUrl,
    github_hash: head,
    primary_skill_path: primaryRel.split(sep).join("/"),
    security_level: input.securityLevel,
    downloaded_at: now,
    last_used_at: now,
    use_count: priorCount,
  };
  writeStatus(status);

  return { key, skill_md_path: resolve(join(target, primaryRel)), cache_hit: false };
}

function findPrimarySkillMd(repoDir: string, skillName: string, subPath?: string): string | null {
  const all = walk(repoDir).filter((p) => p.endsWith(`${sep}SKILL.md`) || p === `${repoDir}${sep}SKILL.md`);
  if (all.length === 0) return null;
  if (subPath) {
    const subPathNorm = subPath.split("/").join(sep);
    const exact = all.find((p) => relative(repoDir, p) === `${subPathNorm}${sep}SKILL.md`);
    if (exact) return exact;
  }
  const preferred = all.filter((p) => {
    const parts = p.split(sep);
    const idx = parts.lastIndexOf("SKILL.md");
    return idx > 0 && parts[idx - 1] === skillName;
  });
  const pool = preferred.length > 0 ? preferred : all;
  return pool.sort((a, b) => a.split(sep).length - b.split(sep).length)[0]!;
}

function walk(root: string): string[] {
  const out: string[] = [];
  const queue = [root];
  while (queue.length) {
    const cur = queue.shift()!;
    let entries: string[] = [];
    try { entries = readdirSync(cur); } catch { continue; }
    for (const e of entries) {
      if (e === ".git") continue;
      const full = join(cur, e);
      let st;
      try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) queue.push(full);
      else out.push(full);
    }
  }
  return out;
}
