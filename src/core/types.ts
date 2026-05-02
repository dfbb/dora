export type SecurityLevel = "safe" | "warn" | "danger" | "unknown";

export interface SkillEntry {
  skill_name: string;
  owner: string;
  repo_url: string;
  github_hash: string;
  primary_skill_path: string;
  security_level: SecurityLevel;
  downloaded_at: string;
  last_used_at: string;
  use_count: number;
}

export interface Status {
  version: 1;
  skills: Record<string, SkillEntry>;
}
