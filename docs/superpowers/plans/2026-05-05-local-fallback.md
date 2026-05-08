# Local BM25 Fallback for `dora_query` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When `dora_query`'s remote engine returns `ENGINE_UNREACHABLE` or `HTTP_ERROR(status≥500||status===429)`, automatically fall back to in-memory BM25 search (via `minisearch`) over the bundled `asset/skilldb.json.gz` catalog (9,465 skills).

**Architecture:** New `src/core/local-query.ts` owns data load + BM25 index + query. `src/mcp/tools.ts#dora_query` is the orchestration layer that decides when to fall back, injects `source: "remote" | "local"` into responses, and synthesizes combined errors. `src/core/query.ts` is unchanged. The catalog is embedded into the esbuild bundle as binary; tests inject an alternate fixture via `DORA_ASSET_DIR`.

**Tech Stack:** TypeScript, Node 18+, vitest, msw (existing); `minisearch@^7` (new).

**Spec:** [`docs/superpowers/specs/2026-05-05-local-fallback-design.md`](../specs/2026-05-05-local-fallback-design.md)

---

## File Structure

**New files:**
- `src/core/local-query.ts` — load asset, gunzip, parse, map to `LocalSkillCandidate`, build minisearch index (singleton), execute query, strip `_local_id` on return. Exports `localQuery` and `__resetLocalIndexForTest`.
- `src/types/assets.d.ts` — `declare module "*.gz" { const x: Uint8Array; export default x; }`. Must live under `src/` to be inside `tsconfig.include`.
- `src/diagnostics/checks/local-index.ts` — calls `loadSkillsCorpus()` + `buildIndex()`, returns `CheckResult`.
- `tests/core/local-query.test.ts` — unit tests for load/map/index/query.
- `tests/mcp/tools-fallback.test.ts` — isolated integration tests for fallback orchestration; uses top-level `vi.mock("@/core/local-query", ...)` so existing `tests/mcp/tools.test.ts` is unaffected.
- `tests/fixtures/skilldb-mini.json` and `tests/fixtures/skilldb-mini.json.gz` — 10-row fixture catalog.
- `tests/fixtures/build-mini-fixture.mjs` — small node script that gzips the json into the gz; committed so the fixture is reproducible.

**Modified files:**
- `src/core/errors.ts` — add `LOCAL_INDEX_BROKEN`.
- `src/mcp/tools.ts` — `dora_query` injects `source: "remote"`, catches fallback-eligible errors, calls `localQuery`, synthesizes combined errors.
- `src/diagnostics/run.ts` — import `checkLocalIndex` and push it into `runChecks()` after `checkEngine`.
- `package.json` — add `minisearch` to dependencies.
- `esbuild.config.mjs` — add `loader: { ".gz": "binary" }` to SHARED.
- `.npmignore` — add `asset/` (defensive; `package.json#files` already controls publish).
- `README.md` — document offline fallback.

**Unchanged (called out to prevent accidental edits):** `src/core/query.ts`, `tests/core/query.test.ts`, `tests/mcp/tools.test.ts`.

---

## Task 1: Add `LOCAL_INDEX_BROKEN` error code

**Files:**
- Modify: `src/core/errors.ts`

- [ ] **Step 1: Add the new error code**

Edit `src/core/errors.ts`. The current `ERR` object ends with `CONFIRMATION_REQUIRED: "confirmation_required"`. Add `LOCAL_INDEX_BROKEN` after it:

```ts
export const ERR = {
  ENGINE_UNREACHABLE: "engine_unreachable",
  HTTP_ERROR: "http_error",
  EMPTY_CANDIDATES: "empty_candidates",
  VALIDATION: "validation",
  CLONE_FAILED: "clone_failed",
  NO_SKILL_MD: "no_skill_md",
  STATUS_CORRUPT: "status_corrupt",
  CONFIRMATION_REQUIRED: "confirmation_required",
  LOCAL_INDEX_BROKEN: "local_index_broken",
} as const;
```

- [ ] **Step 2: Verify typecheck still passes**

Run: `npm run typecheck`
Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/core/errors.ts
git commit -m "feat(errors): add LOCAL_INDEX_BROKEN error code"
```

---

## Task 2: Add `*.gz` module type declaration

**Files:**
- Create: `src/types/assets.d.ts`

- [ ] **Step 1: Create the declaration file**

Create `src/types/assets.d.ts` with:

```ts
declare module "*.gz" {
  const data: Uint8Array;
  export default data;
}
```

It must be under `src/` because `tsconfig.json` only includes `src/**/*` and `tests/**/*`.

- [ ] **Step 2: Verify typecheck still passes**

Run: `npm run typecheck`
Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/assets.d.ts
git commit -m "feat(types): declare *.gz module for esbuild binary loader"
```

---

## Task 3: Configure esbuild to load `.gz` as binary

**Files:**
- Modify: `esbuild.config.mjs`

- [ ] **Step 1: Add the `.gz` binary loader**

Edit `esbuild.config.mjs`. The current `SHARED` object lacks a `loader` key. Add it:

```js
const SHARED = {
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node18",
  external: ["yaml", "zod"],
  minify: false,
  sourcemap: false,
  banner: { js: "#!/usr/bin/env node" },
  alias: { "@": "./src" },
  loader: { ".gz": "binary" },
};
```

- [ ] **Step 2: Verify build still passes**

Run: `npm run build`
Expected: writes `cli.bundle.mjs`, `start.bundle.mjs`, `hooks/sessionstart.bundle.mjs`; prints `bundles written`. No errors. (Bundles will not yet contain the gz — nothing imports it; this just confirms the loader entry doesn't break the build.)

- [ ] **Step 3: Commit**

```bash
git add esbuild.config.mjs
git commit -m "build: configure esbuild to load .gz files as binary"
```

---

## Task 4: Add `minisearch` dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install minisearch**

Run: `npm install minisearch@^7.0.0`
Expected: adds `"minisearch": "^7.x.y"` to `dependencies` in `package.json`, updates `package-lock.json`.

- [ ] **Step 2: Verify the dep landed in dependencies (not devDependencies)**

Run: `node -e "const p=require('./package.json');console.log(p.dependencies.minisearch||'MISSING')"`
Expected: prints something like `^7.0.0` (not `MISSING`).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add minisearch dependency for local BM25 fallback"
```

---

## Task 5: Build the test fixture (10-row mini catalog)

**Files:**
- Create: `tests/fixtures/skilldb-mini.json`
- Create: `tests/fixtures/build-mini-fixture.mjs`
- Create: `tests/fixtures/skilldb-mini.json.gz`

- [ ] **Step 1: Write the source JSON**

Create `tests/fixtures/skilldb-mini.json`. The shape mirrors `asset/skilldb.json` but with hand-picked rows that exercise every test case in Task 8. Note: row 6 omits all three `security_*` fields to test the "missing fields → warn" branch.

```json
{
  "schema_version": 1,
  "exported_at": 1777914524,
  "skills": [
    {
      "name": "pytest-helper",
      "skill_id": "pytest-helper",
      "source_slug": "py/pytest-helper",
      "author": "py",
      "github_url": "https://github.com/py/pytest-helper",
      "skill_url": "https://github.com/py/pytest-helper/tree/main/pytest-helper",
      "summary": "Helps write pytest tests with fixtures",
      "github_star": 100,
      "security_snyk": "Pass",
      "security_socket": "Pass",
      "security_trusthub": "Pass"
    },
    {
      "name": "python-typing",
      "skill_id": "python-typing",
      "source_slug": "py/python-typing",
      "author": "py",
      "github_url": "https://github.com/py/python-typing",
      "skill_url": "https://github.com/py/python-typing/tree/main/python-typing",
      "summary": "Type checking for Python projects",
      "github_star": 80,
      "security_snyk": "Pass",
      "security_socket": "Pass",
      "security_trusthub": "Pass"
    },
    {
      "name": "docker-compose-skill",
      "skill_id": "docker-compose-skill",
      "source_slug": "ops/docker-compose-skill",
      "author": "ops",
      "github_url": "https://github.com/ops/docker-compose-skill",
      "skill_url": "https://github.com/ops/docker-compose-skill/tree/main/docker-compose-skill",
      "summary": "Manage Docker compose stacks",
      "github_star": 50,
      "security_snyk": "Fail",
      "security_socket": "Pass",
      "security_trusthub": "Pass"
    },
    {
      "name": "wechat-publisher",
      "skill_id": "wechat-publisher",
      "source_slug": "media/wechat-publisher",
      "author": "media",
      "github_url": "https://github.com/media/wechat-publisher",
      "skill_url": "https://github.com/media/wechat-publisher/tree/main/wechat-publisher",
      "summary": "Converts Markdown for WeChat",
      "github_star": 30,
      "security_snyk": "Warn",
      "security_socket": "Pass",
      "security_trusthub": "Fail"
    },
    {
      "name": "nix-best-practices",
      "skill_id": "nix-best-practices",
      "source_slug": "nix/nix-best-practices",
      "author": "nix",
      "github_url": "https://github.com/nix/nix-best-practices",
      "skill_url": "https://github.com/nix/nix-best-practices/tree/main/nix-best-practices",
      "summary": "Standardize flake structure",
      "github_star": 60,
      "security_snyk": "Warn",
      "security_socket": "Pass",
      "security_trusthub": "Pass"
    },
    {
      "name": "unrelated-foo",
      "skill_id": "unrelated-foo",
      "source_slug": "x/unrelated-foo",
      "author": "x",
      "github_url": "https://github.com/x/unrelated-foo",
      "skill_url": "https://github.com/x/unrelated-foo/tree/main/unrelated-foo",
      "summary": "Random unrelated content lorem ipsum",
      "github_star": 0
    },
    {
      "name": "react-component-tester",
      "skill_id": "react-component-tester",
      "source_slug": "react/react-component-tester",
      "author": "react",
      "github_url": "https://github.com/react/react-component-tester",
      "skill_url": "https://github.com/react/react-component-tester/tree/main/react-component-tester",
      "summary": "testing components in React",
      "github_star": 40,
      "security_snyk": "Pass",
      "security_socket": "Pass",
      "security_trusthub": "Pass"
    },
    {
      "name": "pythn-lint",
      "skill_id": "pythn-lint",
      "source_slug": "py/pythn-lint",
      "author": "py",
      "github_url": "https://github.com/py/pythn-lint",
      "skill_url": "https://github.com/py/pythn-lint/tree/main/pythn-lint",
      "summary": "Linter for Pythn projects",
      "github_star": 20,
      "security_snyk": "Pass",
      "security_socket": "Pass",
      "security_trusthub": "Pass"
    },
    {
      "name": "skill-creator",
      "skill_id": "skill-creator",
      "source_slug": "alice/repo-a",
      "author": "alice",
      "github_url": "https://github.com/alice/repo-a",
      "skill_url": "https://github.com/alice/repo-a/tree/main/skill-creator",
      "summary": "create skills",
      "github_star": 15,
      "security_snyk": "Pass",
      "security_socket": "Pass",
      "security_trusthub": "Pass"
    },
    {
      "name": "skill-creator",
      "skill_id": "skill-creator",
      "source_slug": "bob/repo-b",
      "author": "bob",
      "github_url": "https://github.com/bob/repo-b",
      "skill_url": "https://github.com/bob/repo-b/tree/main/skill-creator",
      "summary": "create skills different",
      "github_star": 10,
      "security_snyk": "Pass",
      "security_socket": "Pass",
      "security_trusthub": "Pass"
    }
  ]
}
```

- [ ] **Step 2: Write the gzip build script**

Create `tests/fixtures/build-mini-fixture.mjs`:

```js
import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "skilldb-mini.json"));
writeFileSync(join(here, "skilldb-mini.json.gz"), gzipSync(src));
console.log("wrote skilldb-mini.json.gz");
```

- [ ] **Step 3: Run the script to produce the .gz**

Run: `node tests/fixtures/build-mini-fixture.mjs`
Expected: prints `wrote skilldb-mini.json.gz`. Verify with `ls -la tests/fixtures/skilldb-mini.json.gz` — file exists and is non-empty.

- [ ] **Step 4: Commit**

```bash
git add tests/fixtures/skilldb-mini.json tests/fixtures/build-mini-fixture.mjs tests/fixtures/skilldb-mini.json.gz
git commit -m "test: add 10-row mini fixture for local fallback tests"
```

---

## Task 6: Stub `local-query.ts` with public API

This task creates the module skeleton so test infrastructure can import it. Real logic lands in Tasks 7–8 via TDD.

**Files:**
- Create: `src/core/local-query.ts`

- [ ] **Step 1: Create the module skeleton**

Create `src/core/local-query.ts`:

```ts
import type { SkillCandidate, QueryResult } from "./query";
import { DoraError, ERR } from "./errors";

export type LocalQueryResult = QueryResult & { source: "local" };

export async function localQuery(_query: string, _topK: number): Promise<LocalQueryResult> {
  throw new DoraError(ERR.LOCAL_INDEX_BROKEN, "not implemented", { reason: "stub" });
}

export function __resetLocalIndexForTest(): void {
  // populated in Task 7
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: exits 0. (`SkillCandidate` and `QueryResult` are already exported from `src/core/query.ts`.)

- [ ] **Step 3: Commit**

```bash
git add src/core/local-query.ts
git commit -m "feat(core): stub local-query module"
```

---

## Task 7: TDD — load asset, map fields, derive `security_level`, build singleton index

This task implements `loadEmbeddedAsset`, `loadSkillsCorpus`, `buildIndex`, `getIndex`, and `__resetLocalIndexForTest`. We TDD load + mapping + singleton behavior here, then add the actual `localQuery` body in Task 8.

**Files:**
- Create: `tests/core/local-query.test.ts` (initial subset of cases)
- Modify: `src/core/local-query.ts`

- [ ] **Step 1: Write failing tests for load + mapping + reset**

Create `tests/core/local-query.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, copyFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { ERR } from "@/core/errors";

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE_GZ = join(here, "..", "fixtures", "skilldb-mini.json.gz");

let work: string;
const orig = { ...process.env };

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), "dora-local-"));
  copyFileSync(FIXTURE_GZ, join(work, "skilldb.json.gz"));
  process.env.DORA_ASSET_DIR = work;
});

afterEach(async () => {
  const mod = await import("@/core/local-query");
  mod.__resetLocalIndexForTest();
  process.env = { ...orig };
  rmSync(work, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("local-query: load + map", () => {
  it("loads fixture and maps fields correctly", async () => {
    const { localQuery } = await import("@/core/local-query");
    const r = await localQuery("pytest", 5);
    const top = r.skills[0]!;
    expect(top.name).toBe("pytest-helper");
    expect(top.url).toBe("https://github.com/py/pytest-helper");
    expect((top as any).skill_path_url).toBe("https://github.com/py/pytest-helper/tree/main/pytest-helper");
    expect(top.description_en).toBe("Helps write pytest tests with fixtures");
    expect(top.github_stars).toBe(100);
    expect(top.security_level).toBe("safe");
    expect((top as any)._local_id).toBeUndefined();
  });

  it("derives security_level: all Pass -> safe", async () => {
    const { localQuery } = await import("@/core/local-query");
    const r = await localQuery("pytest", 5);
    expect(r.skills[0]!.security_level).toBe("safe");
  });

  it("derives security_level: any Fail -> danger", async () => {
    const { localQuery } = await import("@/core/local-query");
    const r = await localQuery("docker compose", 5);
    const docker = r.skills.find((s) => s.name === "docker-compose-skill")!;
    expect(docker.security_level).toBe("danger");
  });

  it("derives security_level: mixed Pass/Warn (no Fail) -> warn", async () => {
    const { localQuery } = await import("@/core/local-query");
    const r = await localQuery("flake structure", 5);
    const nix = r.skills.find((s) => s.name === "nix-best-practices")!;
    expect(nix.security_level).toBe("warn");
  });

  it("derives security_level: missing fields -> warn", async () => {
    const { localQuery } = await import("@/core/local-query");
    const r = await localQuery("unrelated lorem", 5);
    const unrelated = r.skills.find((s) => s.name === "unrelated-foo")!;
    expect(unrelated.security_level).toBe("warn");
  });

  it("includes source: 'local' in result", async () => {
    const { localQuery } = await import("@/core/local-query");
    const r = await localQuery("pytest", 5);
    expect(r.source).toBe("local");
  });

  it("does not collapse duplicate skill_id (composite _local_id)", async () => {
    const { localQuery } = await import("@/core/local-query");
    const r = await localQuery("create skills", 10);
    const creators = r.skills.filter((s) => s.name === "skill-creator");
    expect(creators).toHaveLength(2);
    const slugs = creators.map((s) => (s as any).source_slug).sort();
    expect(slugs).toEqual(["alice/repo-a", "bob/repo-b"]);
  });
});

describe("local-query: errors", () => {
  it("throws LOCAL_INDEX_BROKEN when asset file is missing", async () => {
    rmSync(join(work, "skilldb.json.gz"));
    const { localQuery, __resetLocalIndexForTest } = await import("@/core/local-query");
    __resetLocalIndexForTest();
    await expect(localQuery("anything", 5)).rejects.toMatchObject({
      code: ERR.LOCAL_INDEX_BROKEN,
      detail: { reason: "asset_read_failed" },
    });
  });

  it("throws LOCAL_INDEX_BROKEN on gunzip failure", async () => {
    writeFileSync(join(work, "skilldb.json.gz"), Buffer.from("not a gzip"));
    const { localQuery, __resetLocalIndexForTest } = await import("@/core/local-query");
    __resetLocalIndexForTest();
    await expect(localQuery("anything", 5)).rejects.toMatchObject({
      code: ERR.LOCAL_INDEX_BROKEN,
      detail: { reason: "gunzip_failed" },
    });
  });

  it("throws LOCAL_INDEX_BROKEN on JSON parse failure", async () => {
    writeFileSync(join(work, "skilldb.json.gz"), gzipSync(Buffer.from("{not json")));
    const { localQuery, __resetLocalIndexForTest } = await import("@/core/local-query");
    __resetLocalIndexForTest();
    await expect(localQuery("anything", 5)).rejects.toMatchObject({
      code: ERR.LOCAL_INDEX_BROKEN,
      detail: { reason: "json_parse_failed" },
    });
  });

  it("throws LOCAL_INDEX_BROKEN on schema_version mismatch", async () => {
    writeFileSync(join(work, "skilldb.json.gz"), gzipSync(Buffer.from(JSON.stringify({ schema_version: 99, skills: [] }))));
    const { localQuery, __resetLocalIndexForTest } = await import("@/core/local-query");
    __resetLocalIndexForTest();
    await expect(localQuery("anything", 5)).rejects.toMatchObject({
      code: ERR.LOCAL_INDEX_BROKEN,
      detail: { reason: "schema_mismatch" },
    });
  });
});

describe("local-query: singleton", () => {
  it("reuses the index across calls (does not re-read file)", async () => {
    const { localQuery } = await import("@/core/local-query");
    await localQuery("pytest", 5);
    rmSync(join(work, "skilldb.json.gz"));
    const r2 = await localQuery("pytest", 5);
    expect(r2.skills[0]!.name).toBe("pytest-helper");
  });

  it("__resetLocalIndexForTest forces a reload", async () => {
    const { localQuery, __resetLocalIndexForTest } = await import("@/core/local-query");
    await localQuery("pytest", 5);
    __resetLocalIndexForTest();
    rmSync(join(work, "skilldb.json.gz"));
    await expect(localQuery("pytest", 5)).rejects.toMatchObject({
      code: ERR.LOCAL_INDEX_BROKEN,
    });
  });
});
```

- [ ] **Step 2: Run tests, confirm they fail**

Run: `npx vitest run tests/core/local-query.test.ts`
Expected: all tests fail because `localQuery` is the stub from Task 6. Failures should mention `not implemented` / `stub`.

- [ ] **Step 3: Implement load + map + index + singleton in `local-query.ts`**

Replace the contents of `src/core/local-query.ts` with:

```ts
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
    if (cand) skills.push(stripLocalId(cand));
  }
  return { skills, source: "local" };
}
```

- [ ] **Step 4: Run tests, confirm they pass**

Run: `npx vitest run tests/core/local-query.test.ts`
Expected: all tests in `local-query: load + map`, `local-query: errors`, `local-query: singleton` pass. (Additional ranking tests come in Task 8.)

- [ ] **Step 5: Run full test suite to confirm nothing else broke**

Run: `npm test`
Expected: all existing tests still pass plus the new ones.

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add src/core/local-query.ts tests/core/local-query.test.ts
git commit -m "feat(core): implement local-query load, mapping, and index singleton"
```

---

## Task 8: TDD — ranking, prefix, fuzzy, AND, topK, empty

Add the remaining test cases from the spec test matrix. The implementation from Task 7 should already satisfy them — this task is mostly verifying the behavior we already wired.

**Files:**
- Modify: `tests/core/local-query.test.ts`

- [ ] **Step 1: Append ranking + search-options test cases**

Append to the bottom of `tests/core/local-query.test.ts` (before the file's final newline, after the existing `describe` blocks):

```ts
describe("local-query: ranking and search options", () => {
  it("name match outranks description-only match", async () => {
    const { localQuery } = await import("@/core/local-query");
    const r = await localQuery("pytest", 5);
    expect(r.skills[0]!.name).toBe("pytest-helper");
  });

  it("prefix match: 'test' hits 'testing'", async () => {
    const { localQuery } = await import("@/core/local-query");
    const r = await localQuery("test", 10);
    const names = r.skills.map((s) => s.name);
    expect(names).toContain("react-component-tester");
  });

  it("fuzzy match: 1-char typo still matches", async () => {
    const { localQuery } = await import("@/core/local-query");
    const r = await localQuery("python", 10);
    const names = r.skills.map((s) => s.name);
    expect(names).toContain("pythn-lint");
  });

  it("AND combine: requires all tokens to match", async () => {
    const { localQuery } = await import("@/core/local-query");
    const r = await localQuery("python typing", 5);
    expect(r.skills[0]!.name).toBe("python-typing");
  });

  it("topK truncates results", async () => {
    const { localQuery } = await import("@/core/local-query");
    const r = await localQuery("create skills", 1);
    expect(r.skills).toHaveLength(1);
  });

  it("throws EMPTY_CANDIDATES when nothing matches", async () => {
    const { localQuery } = await import("@/core/local-query");
    await expect(localQuery("zzznotarealtoken", 5)).rejects.toMatchObject({
      code: ERR.EMPTY_CANDIDATES,
    });
  });
});
```

- [ ] **Step 2: Run the new tests**

Run: `npx vitest run tests/core/local-query.test.ts -t "ranking and search options"`
Expected: all 6 tests pass.

- [ ] **Step 3: Run the full local-query suite**

Run: `npx vitest run tests/core/local-query.test.ts`
Expected: every test passes.

- [ ] **Step 4: Commit**

```bash
git add tests/core/local-query.test.ts
git commit -m "test(local-query): cover ranking, prefix, fuzzy, AND, topK, empty"
```

---

## Task 9: TDD — wire fallback into `dora_query` (orchestration)

This task changes `tools.ts#dora_query`. We use a **separate** test file (`tools-fallback.test.ts`) with `vi.mock("@/core/local-query")` so the existing `tests/mcp/tools.test.ts` is not disturbed.

**Files:**
- Create: `tests/mcp/tools-fallback.test.ts`
- Modify: `src/mcp/tools.ts`

- [ ] **Step 1: Write the failing fallback integration tests**

Create `tests/mcp/tools-fallback.test.ts`:

```ts
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const localQueryMock = vi.fn();

vi.mock("@/core/local-query", () => ({
  localQuery: localQueryMock,
  __resetLocalIndexForTest: () => {},
}));

const ENGINE = "http://127.0.0.1:8080";
const server = setupServer();
let work: string;
const orig = { ...process.env };

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), "dora-fb-"));
  process.env.DORA_HOME = work;
  server.resetHandlers();
  localQueryMock.mockReset();
});

afterEach(() => {
  process.env = { ...orig };
  rmSync(work, { recursive: true, force: true });
  vi.restoreAllMocks();
});

async function callQuery() {
  const { handlers } = await import("@/mcp/tools");
  return JSON.parse(await handlers.dora_query({ query: "anything" }));
}

describe("dora_query fallback", () => {
  it("A: remote 200 -> source remote, local not called", async () => {
    server.use(http.post(`${ENGINE}/retrieve`, () => HttpResponse.json({
      skills: [{ name: "x", url: "https://github.com/a/b", security_level: "safe" }],
    })));
    const r = await callQuery();
    expect(r.source).toBe("remote");
    expect(r.skills).toHaveLength(1);
    expect(localQueryMock).not.toHaveBeenCalled();
  });

  it("B: remote network error -> falls back to local, stderr warn", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    server.use(http.post(`${ENGINE}/retrieve`, () => HttpResponse.error()));
    localQueryMock.mockResolvedValue({ skills: [{ name: "local-x" }], source: "local" });
    const r = await callQuery();
    expect(r.source).toBe("local");
    expect(r.skills[0].name).toBe("local-x");
    expect(localQueryMock).toHaveBeenCalledOnce();
    const msgs = errSpy.mock.calls.map((c) => String(c[0]));
    expect(msgs.some((m) => m.includes("[dora] remote engine engine_unreachable"))).toBe(true);
  });

  it("C: remote 502 -> falls back to local", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    server.use(http.post(`${ENGINE}/retrieve`, () => new HttpResponse("boom", { status: 502 })));
    localQueryMock.mockResolvedValue({ skills: [{ name: "local-y" }], source: "local" });
    const r = await callQuery();
    expect(r.source).toBe("local");
    expect(localQueryMock).toHaveBeenCalledOnce();
  });

  it("C2: remote 429 -> falls back to local", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    server.use(http.post(`${ENGINE}/retrieve`, () => new HttpResponse("rate", { status: 429 })));
    localQueryMock.mockResolvedValue({ skills: [{ name: "local-z" }], source: "local" });
    const r = await callQuery();
    expect(r.source).toBe("local");
    expect(localQueryMock).toHaveBeenCalledOnce();
  });

  it("D: remote returns empty -> NOT a fallback, returns empty_candidates", async () => {
    server.use(http.post(`${ENGINE}/retrieve`, () => HttpResponse.json({ skills: [] })));
    const r = await callQuery();
    expect(r.error).toBe("empty_candidates");
    expect(localQueryMock).not.toHaveBeenCalled();
  });

  it.each([401, 403, 404])("D2: remote %i -> NOT a fallback", async (status) => {
    server.use(http.post(`${ENGINE}/retrieve`, () => new HttpResponse("nope", { status })));
    const r = await callQuery();
    expect(r.error).toBe("http_error");
    expect(localQueryMock).not.toHaveBeenCalled();
  });

  it("E: remote fails + local broken -> synthesized error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    server.use(http.post(`${ENGINE}/retrieve`, () => HttpResponse.error()));
    const { DoraError, ERR } = await import("@/core/errors");
    localQueryMock.mockRejectedValue(
      new DoraError(ERR.LOCAL_INDEX_BROKEN, "boom", { reason: "schema_mismatch" }),
    );
    const r = await callQuery();
    expect(r.error).toBe("engine_unreachable");
    expect(r.detail.remote_code).toBe("engine_unreachable");
    expect(r.detail.local_code).toBe("local_index_broken");
  });
});
```

- [ ] **Step 2: Run the tests, confirm they fail**

Run: `npx vitest run tests/mcp/tools-fallback.test.ts`
Expected: most tests fail because `tools.ts#dora_query` does not yet inject `source` or call `localQuery`. Test A may also fail (no `source` field on success).

- [ ] **Step 3: Update `dora_query` in `src/mcp/tools.ts`**

Replace the imports block at the top of `src/mcp/tools.ts` to include `localQuery`:

```ts
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
```

Replace the `dora_query` handler (the existing implementation reads `cfg`, calls `queryEngine`, returns `JSON.stringify(r)`) with:

```ts
  async dora_query(args: unknown): Promise<string> {
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
  },
```

Add `shouldFallback` as a private helper just below the `err` helper near the top of the file:

```ts
function shouldFallback(e: unknown): boolean {
  if (!isDoraError(e)) return false;
  if (e.code === ERR.ENGINE_UNREACHABLE) return true;
  if (e.code === ERR.HTTP_ERROR) {
    const status = (e.detail as { status?: number } | undefined)?.status;
    return typeof status === "number" && (status >= 500 || status === 429);
  }
  return false;
}
```

- [ ] **Step 4: Run the fallback tests, confirm they pass**

Run: `npx vitest run tests/mcp/tools-fallback.test.ts`
Expected: all 7 cases pass (A, B, C, C2, D, D2 ×3, E).

- [ ] **Step 5: Run the full suite (existing tools.test.ts must still pass)**

Run: `npm test`
Expected: every test passes — existing `tests/mcp/tools.test.ts` and the e2e flow still work; the new `tools-fallback.test.ts` also passes.

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add src/mcp/tools.ts tests/mcp/tools-fallback.test.ts
git commit -m "feat(mcp): wire local BM25 fallback into dora_query"
```

---

## Task 10: Add `dora_doctor` check for local index

**Files:**
- Create: `src/diagnostics/checks/local-index.ts`
- Modify: `src/diagnostics/run.ts`

- [ ] **Step 1: Write the check**

Create `src/diagnostics/checks/local-index.ts`:

```ts
import type { CheckResult } from "../run";
import { isDoraError } from "@/core/errors";
import { localQuery, __resetLocalIndexForTest } from "@/core/local-query";

export async function checkLocalIndex(): Promise<CheckResult> {
  __resetLocalIndexForTest();
  try {
    await localQuery("smoke", 1);
    return { name: "local index", status: "pass" };
  } catch (e) {
    if (isDoraError(e)) {
      if (e.code === "empty_candidates") {
        return { name: "local index", status: "pass" };
      }
      const reason = (e.detail as { reason?: string } | undefined)?.reason;
      return { name: "local index", status: "fail", detail: reason ?? e.code };
    }
    return { name: "local index", status: "fail", detail: (e as Error).message };
  }
}
```

We treat `empty_candidates` as `pass` because the index loaded fine — the smoke query "smoke" just didn't match anything, which is not an index health issue.

- [ ] **Step 2: Wire it into `runChecks`**

Edit `src/diagnostics/run.ts`. Add the import beside the others:

```ts
import { checkLocalIndex } from "./checks/local-index";
```

And in `runChecks()`, push it right after `checkEngine`:

```ts
  results.push(await checkEngine());
  results.push(await checkLocalIndex());
  results.push(await checkStatus());
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 4: Run existing diagnostics tests**

Run: `npx vitest run tests/diagnostics`
Expected: any existing tests still pass. (If the tests assert a specific check count or order, update them — but since this is a brand-new check, test files added in earlier tasks may need adjustment if they snapshot the doctor output. Inspect failures and fix.)

- [ ] **Step 5: Run full suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/diagnostics/checks/local-index.ts src/diagnostics/run.ts
git commit -m "feat(doctor): add local index health check"
```

---

## Task 11: Defensive `.npmignore` entry

**Files:**
- Modify: `.npmignore`

- [ ] **Step 1: Add `asset/` to `.npmignore`**

Read the current `.npmignore`. Append `asset/` on its own line if it's not already there:

```
asset/
```

(`package.json#files` is a whitelist that already excludes `asset/` from the npm tarball; this entry is defensive against a future change.)

- [ ] **Step 2: Verify `npm pack --dry-run` does not include `asset/`**

Run: `npm pack --dry-run 2>&1 | grep -E 'asset/|skilldb' || echo "asset not in pack"`
Expected: prints `asset not in pack`.

- [ ] **Step 3: Commit**

```bash
git add .npmignore
git commit -m "build: defensively ignore asset/ in npm publish"
```

---

## Task 12: Smoke-test the embedded asset path with a real bundle

This task verifies that `import "../../asset/skilldb.json.gz"` works through the esbuild bundle (i.e., the `.gz` loader is wired correctly and produces a usable `Uint8Array` at runtime). We don't add a permanent test; we run a one-off check.

**Files:** none modified.

- [ ] **Step 1: Build the bundles**

Run: `npm run build`
Expected: writes `cli.bundle.mjs` and `start.bundle.mjs` without errors. `bundles written` printed.

- [ ] **Step 2: Verify the gz bytes are embedded in the bundle**

Run: `wc -c start.bundle.mjs && wc -c cli.bundle.mjs`
Expected: each bundle is at least ~1.8MB larger than before this feature (since the gz is now embedded). A bundle under 1MB likely means the `.gz` loader did not run.

- [ ] **Step 3: Smoke-test local fallback through the built bundle**

Run:
```bash
DORA_HOME="$(mktemp -d)" \
node -e '
  import("./start.bundle.mjs").then(async () => {
    // start.bundle.mjs starts a server on stdio — instead, we exercise
    // the local-query module by importing the source directly via tsx-equivalent.
    // For this smoke test, just confirm the asset bytes are present:
    const fs = await import("node:fs");
    const buf = fs.readFileSync("start.bundle.mjs");
    if (buf.length < 1_500_000) throw new Error("bundle too small — gz not embedded?");
    console.log("bundle size OK:", buf.length, "bytes");
  });
'
```
Expected: prints `bundle size OK: <number> bytes` with `<number>` ≥ 1,500,000.

- [ ] **Step 4: Run the full test suite one more time**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Run typecheck once more**

Run: `npm run typecheck`
Expected: exits 0.

(No commit — this task is verification only.)

---

## Task 13: Document the offline fallback in README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the "What it does" section**

Find the "What it does" section in `README.md` and append a sentence at the end:

```
When the remote skill engine is unreachable or returns 5xx/429, dora automatically falls back to an in-memory BM25 search over a bundled snapshot of ~9.5k community skills.
```

- [ ] **Step 2: Add an "Offline Fallback" section**

After the "Data" section (or before "License" if "Data" doesn't exist), insert:

```markdown
## Offline Fallback

`dora_query` automatically falls back to a local catalog when the remote engine is unreachable.

- **Triggers:** `engine_unreachable` (network/timeout) or `http_error` with status ≥ 500 or status === 429. Other 4xx errors are returned to the caller as-is so configuration/auth issues are not hidden.
- **Catalog:** ~9,465 skills, bundled into the npm package (no extra download).
- **Result shape:** identical to remote (`{skills: [...]}`) plus a `source: "remote" | "local"` field on the returned JSON.
- **Diagnostics:** `dora_doctor` includes a `local index` check.

Empty results from the remote engine (`empty_candidates`) are NOT a fallback trigger — if the remote service explicitly says no match, dora trusts that answer.
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs(readme): document offline BM25 fallback"
```

---

## Self-Review Checklist (run after all tasks complete)

- [ ] `npm test` — all green
- [ ] `npm run typecheck` — exits 0
- [ ] `npm run build` — bundles written; `cli.bundle.mjs` and `start.bundle.mjs` each ≥ ~1.8 MB
- [ ] `git log --oneline` shows 12 commits (one per task with code changes; Task 12 has none)
- [ ] `dora_query` returns `source: "remote"` when remote 200 and `source: "local"` after fallback
- [ ] `dora_doctor` lists `local index` as a check

If any item fails, fix the underlying task and re-run.
