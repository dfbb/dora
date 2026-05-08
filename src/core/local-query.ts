import { gunzipSync } from "node:zlib";
import MiniSearch from "minisearch";
import type { SkillCandidate, QueryResult } from "./query";
import { DoraError, ERR } from "./errors";
import type { SecurityLevel } from "./types";
import embeddedSkillshGz from "../../asset/skilldb.json.gz";

export type LocalQueryResult = QueryResult & { source: "local" };

interface RawSkill {
  name: string;
  skill_id: string;
  source_slug: string;
  author?: string;
  github_url?: string;
  skill_url?: string;
  summary?: string;
  github_star?: number;
  security_snyk?: string;
  security_socket?: string;
  security_trusthub?: string;
}

interface LocalSkillCandidate extends SkillCandidate {
  _local_id: string;
  skill_id: string;
  source_slug: string;
  author?: string;
  skill_path_url?: string;
}

let _idx: {
  mini: MiniSearch<LocalSkillCandidate>;
  corpus: Map<string, LocalSkillCandidate>;
} | null = null;

export function __resetLocalIndexForTest(): void {
  _idx = null;
}

async function loadEmbeddedAsset(): Promise<Uint8Array> {
  const dir = process.env.DORA_ASSET_DIR;
  if (!dir) return embeddedSkillshGz;
  try {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    return readFileSync(join(dir, "skilldb.json.gz"));
  } catch (e) {
    throw new DoraError(ERR.LOCAL_INDEX_BROKEN, "asset read failed", {
      reason: "asset_read_failed",
      cause: (e as Error).message,
    });
  }
}

function deriveSecurityLevel(s: RawSkill): SecurityLevel {
  const vals = [s.security_snyk, s.security_socket, s.security_trusthub];
  if (vals.some((v) => v === "Fail")) return "danger";
  if (vals.every((v) => v === "Pass")) return "safe";
  return "warn";
}

function mapToCandidate(s: RawSkill): LocalSkillCandidate {
  return {
    _local_id: `${s.source_slug}#${s.skill_id}`,
    name: s.name,
    url: s.github_url,
    skill_path_url: s.skill_url,
    description_en: s.summary,
    github_stars: s.github_star,
    security_level: deriveSecurityLevel(s),
    source_slug: s.source_slug,
    skill_id: s.skill_id,
    author: s.author,
  };
}

async function loadSkillsCorpus(): Promise<LocalSkillCandidate[]> {
  const raw = await loadEmbeddedAsset();
  let unzipped: Buffer;
  try {
    unzipped = gunzipSync(Buffer.from(raw));
  } catch (e) {
    throw new DoraError(ERR.LOCAL_INDEX_BROKEN, "gunzip failed", {
      reason: "gunzip_failed",
      cause: (e as Error).message,
    });
  }
  let json: { schema_version: number; skills: RawSkill[] };
  try {
    json = JSON.parse(unzipped.toString("utf8"));
  } catch (e) {
    throw new DoraError(ERR.LOCAL_INDEX_BROKEN, "JSON parse failed", {
      reason: "json_parse_failed",
      cause: (e as Error).message,
    });
  }
  if (json.schema_version !== 1 || !Array.isArray(json.skills)) {
    throw new DoraError(ERR.LOCAL_INDEX_BROKEN, "schema mismatch", {
      reason: "schema_mismatch",
      got: json.schema_version,
    });
  }
  return json.skills.map(mapToCandidate);
}

function buildMiniSearch(corpus: LocalSkillCandidate[]): MiniSearch<LocalSkillCandidate> {
  const mini = new MiniSearch<LocalSkillCandidate>({
    idField: "_local_id",
    fields: ["name", "description_en", "source_slug", "author"],
    storeFields: ["_local_id"],
    searchOptions: {
      boost: { name: 3, description_en: 2, source_slug: 1.5, author: 1 },
      combineWith: "AND",
      prefix: true,
      fuzzy: 0.2,
    },
  });
  try {
    mini.addAll(corpus);
  } catch (e) {
    throw new DoraError(ERR.LOCAL_INDEX_BROKEN, "index build failed", {
      reason: "index_build_failed",
      cause: (e as Error).message,
    });
  }
  return mini;
}

async function getIndex() {
  if (_idx) return _idx;
  const corpus = await loadSkillsCorpus();
  const mini = buildMiniSearch(corpus);
  _idx = { mini, corpus: new Map(corpus.map((s) => [s._local_id, s])) };
  return _idx;
}

function stripLocalId(s: LocalSkillCandidate): SkillCandidate {
  const { _local_id, ...rest } = s;
  void _local_id;
  return rest;
}

export async function localQuery(query: string, topK: number): Promise<LocalQueryResult> {
  const idx = await getIndex();
  let rows: Array<{ id: unknown }>;
  try {
    rows = idx.mini.search(query) as Array<{ id: unknown }>;
  } catch (e) {
    throw new DoraError(ERR.LOCAL_INDEX_BROKEN, "search failed", {
      reason: "search_failed",
      cause: (e as Error).message,
    });
  }
  if (rows.length === 0) {
    throw new DoraError(ERR.EMPTY_CANDIDATES, "no matching skill (local)", { query });
  }
  const skills: SkillCandidate[] = [];
  for (const row of rows.slice(0, topK)) {
    const cand = idx.corpus.get(String(row.id));
    if (!cand) throw new DoraError(ERR.LOCAL_INDEX_BROKEN, "corpus/index mismatch", { id: String(row.id) });
    skills.push(stripLocalId(cand));
  }
  return { skills, source: "local" };
}
