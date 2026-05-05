import { existsSync, readFileSync } from "node:fs";
import { parse } from "yaml";
import { z } from "zod";
import { configPath } from "./paths";

export const DEFAULTS = {
  skill_query_url: "http://api.doraskill.org",
  skill_query_mode: "graph",
  top_k: 5,
  cache_ttl_days: 7,
  min_security_level: "safe" as const,
  query_timeout_seconds: 30,
} as const;

const ConfigSchema = z.object({
  skill_query_url: z.string().url().default(DEFAULTS.skill_query_url),
  skill_query_mode: z.string().min(1).default(DEFAULTS.skill_query_mode),
  top_k: z.number().int().positive().default(DEFAULTS.top_k),
  cache_ttl_days: z.number().int().nonnegative().default(DEFAULTS.cache_ttl_days),
  min_security_level: z.enum(["safe", "warn", "danger"]).default(DEFAULTS.min_security_level),
  query_timeout_seconds: z.number().int().positive().default(DEFAULTS.query_timeout_seconds),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  const p = configPath();
  let user: unknown = {};
  if (existsSync(p)) {
    user = parse(readFileSync(p, "utf8")) ?? {};
  }
  return ConfigSchema.parse({ ...DEFAULTS, ...(user as object) });
}
