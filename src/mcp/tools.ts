import { z } from "zod";
import { loadConfig } from "@/core/config";
import { queryEngine } from "@/core/query";
import { localQuery } from "@/core/local-query";
import { loadSkill } from "@/core/loader";
import { listSkills, purgeAll, touch } from "@/core/cache";
import { isDoraError, ERR, DoraError } from "@/core/errors";
import { buildStats } from "@/stats";
import { buildUpgradeCommand } from "@/upgrade";
import { runDoctor } from "@/diagnostics/run";
import type { SecurityLevel } from "@/core/types";

const QuerySchema = z.object({ query: z.string().min(1) });
const LoadSchema = z.object({
  name: z.string().min(1),
  repo_url: z.string().min(1),
  security_level: z.enum(["safe", "warn", "danger", "unknown"]),
});
const TouchSchema = z.object({ key: z.string().min(1) });
const PurgeSchema = z.object({ confirm: z.boolean() });

function err(e: unknown): string {
  if (isDoraError(e)) return JSON.stringify({ error: e.code, message: e.message, detail: e.detail });
  return JSON.stringify({ error: "internal", message: (e as Error).message });
}

function shouldFallback(e: unknown): boolean {
  if (!isDoraError(e)) return false;
  if (e.code === ERR.ENGINE_UNREACHABLE) return true;
  if (e.code === ERR.HTTP_ERROR) {
    const status = (e.detail as { status?: number } | undefined)?.status;
    return typeof status === "number" && (status >= 500 || status === 429 || status === 404);
  }
  return false;
}

export const handlers = {
  async dora_query(args: unknown): Promise<string> {
    try {
      const a = QuerySchema.parse(args);
      const cfg = loadConfig();
      try {
        const r = await queryEngine(a.query, {
          url: cfg.skill_query_url, mode: cfg.skill_query_mode,
          topK: cfg.top_k, timeoutMs: cfg.query_timeout_seconds * 1000,
        });
        return JSON.stringify({ ...r, source: "remote" });
      } catch (e) {
        if (shouldFallback(e)) {
          const remote = e as DoraError;
          console.error(`[dora] remote engine ${remote.code}, falling back to local`);
          try {
            const r = await localQuery(a.query, cfg.top_k);
            return JSON.stringify(r);
          } catch (fe) {
            if (isDoraError(fe)) {
              return JSON.stringify({
                error: remote.code,
                message: `${remote.message}; local fallback also failed: ${fe.message}`,
                detail: { remote_code: remote.code, local_code: fe.code },
              });
            }
            return err(fe);
          }
        }
        return err(e);
      }
    } catch (e) { return err(e); }
  },

  async dora_load(args: unknown): Promise<string> {
    try {
      const a = LoadSchema.parse(args);
      const r = await loadSkill({ name: a.name, repoUrl: a.repo_url, securityLevel: a.security_level as SecurityLevel });
      return JSON.stringify(r);
    } catch (e) { return err(e); }
  },

  async dora_touch(args: unknown): Promise<string> {
    try {
      const a = TouchSchema.parse(args);
      touch(a.key);
      return JSON.stringify({ ok: true });
    } catch (e) { return err(e); }
  },

  async dora_list(_args: unknown): Promise<string> {
    const rows = listSkills();
    if (rows.length === 0) return "no skills cached.";
    const header = "| key | uses | age | sec | status |\n|---|---|---|---|---|";
    const body = rows.map((r) =>
      `| ${r.key} | ${r.use_count} | ${r.age_days ?? "-"} | ${r.security_level} | ${r.status} |`).join("\n");
    return `${header}\n${body}`;
  },

  async dora_stats(_args: unknown): Promise<string> { return buildStats(); },
  async dora_doctor(_args: unknown): Promise<string> { return await runDoctor(); },
  async dora_upgrade(_args: unknown): Promise<string> { return JSON.stringify({ shell: buildUpgradeCommand() }); },

  async dora_purge(args: unknown): Promise<string> {
    try {
      const a = PurgeSchema.parse(args);
      if (!a.confirm) return JSON.stringify({ error: ERR.CONFIRMATION_REQUIRED, message: "pass confirm: true" });
      return JSON.stringify(purgeAll());
    } catch (e) { return err(e); }
  },
};

export const toolDefs = [
  { name: "dora_query", description: "Query skill engine for candidates by natural-language task.", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "dora_load", description: "Clone a skill repo and locate its SKILL.md.", inputSchema: { type: "object", properties: { name: { type: "string" }, repo_url: { type: "string" }, security_level: { type: "string", enum: ["safe", "warn", "danger", "unknown"] } }, required: ["name", "repo_url", "security_level"] } },
  { name: "dora_touch", description: "Mark a cached skill as used.", inputSchema: { type: "object", properties: { key: { type: "string" } }, required: ["key"] } },
  { name: "dora_list", description: "List all cached skills.", inputSchema: { type: "object", properties: {} } },
  { name: "dora_stats", description: "Show usage statistics.", inputSchema: { type: "object", properties: {} } },
  { name: "dora_doctor", description: "Run all diagnostics.", inputSchema: { type: "object", properties: {} } },
  { name: "dora_upgrade", description: "Return upgrade shell command.", inputSchema: { type: "object", properties: {} } },
  { name: "dora_purge", description: "Permanently delete all cached skills.", inputSchema: { type: "object", properties: { confirm: { type: "boolean" } }, required: ["confirm"] } },
] as const;
