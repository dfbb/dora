import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { readRecentQueryLog } from "./core/log";
import { skillsDir } from "./core/paths";
import { ensureConsistent } from "./core/status";

export function buildStats(): string {
  const status = ensureConsistent();
  const dir = skillsDir();
  const totalBytes = existsSync(dir) ? dirSize(dir) : 0;
  const totalSkills = Object.keys(status.skills).length;

  const top = Object.entries(status.skills)
    .sort((a, b) => (b[1].use_count ?? 0) - (a[1].use_count ?? 0))
    .slice(0, 5);

  const sevenDaysAgo = Date.now() - 7 * 86_400_000;
  const last7d = Object.values(status.skills)
    .filter((e) => Date.parse(e.last_used_at) >= sevenDaysAgo).length;

  const log = readRecentQueryLog(50);
  const avg = log.length ? log.reduce((s, r) => s + r.candidate_count, 0) / log.length : 0;

  const lines: string[] = [];
  lines.push("## dora skills");
  lines.push("");
  lines.push(`- Total cached: ${totalSkills} skills, ${(totalBytes / 1_048_576).toFixed(1)} MB on disk`);
  lines.push("- Top by use_count:");
  if (top.length === 0) {
    lines.push("  _(none)_");
  } else {
    lines.push("  | key | uses | last used | sec |");
    lines.push("  |---|---|---|---|");
    for (const [k, e] of top) {
      const days = Math.max(0, Math.floor((Date.now() - Date.parse(e.last_used_at)) / 86_400_000));
      lines.push(`  | ${k} | ${e.use_count ?? 0} | ${days}d ago | ${e.security_level} |`);
    }
  }
  lines.push(`- Used in last 7d: ${last7d}`);
  lines.push(`- Avg candidates per query: ${avg.toFixed(1)} (last ${log.length} queries)`);
  return lines.join("\n");
}

function dirSize(dir: string): number {
  let total = 0;
  const queue = [dir];
  while (queue.length) {
    const cur = queue.shift()!;
    let entries: string[] = [];
    try { entries = readdirSync(cur); } catch { continue; }
    for (const e of entries) {
      const full = join(cur, e);
      let st;
      try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) queue.push(full);
      else total += st.size;
    }
  }
  return total;
}
