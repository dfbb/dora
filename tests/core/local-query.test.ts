import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { ERR } from "@/core/errors";

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE_GZ = join(here, "..", "fixtures", "skillsh-mini.json.gz");

let work: string;
const orig = { ...process.env };

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), "dora-local-"));
  copyFileSync(FIXTURE_GZ, join(work, "skillsh.json.gz"));
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
    rmSync(join(work, "skillsh.json.gz"));
    const { localQuery, __resetLocalIndexForTest } = await import("@/core/local-query");
    __resetLocalIndexForTest();
    await expect(localQuery("anything", 5)).rejects.toMatchObject({
      code: ERR.LOCAL_INDEX_BROKEN,
      detail: { reason: "asset_read_failed" },
    });
  });

  it("throws LOCAL_INDEX_BROKEN on gunzip failure", async () => {
    writeFileSync(join(work, "skillsh.json.gz"), Buffer.from("not a gzip"));
    const { localQuery, __resetLocalIndexForTest } = await import("@/core/local-query");
    __resetLocalIndexForTest();
    await expect(localQuery("anything", 5)).rejects.toMatchObject({
      code: ERR.LOCAL_INDEX_BROKEN,
      detail: { reason: "gunzip_failed" },
    });
  });

  it("throws LOCAL_INDEX_BROKEN on JSON parse failure", async () => {
    writeFileSync(join(work, "skillsh.json.gz"), gzipSync(Buffer.from("{not json")));
    const { localQuery, __resetLocalIndexForTest } = await import("@/core/local-query");
    __resetLocalIndexForTest();
    await expect(localQuery("anything", 5)).rejects.toMatchObject({
      code: ERR.LOCAL_INDEX_BROKEN,
      detail: { reason: "json_parse_failed" },
    });
  });

  it("throws LOCAL_INDEX_BROKEN on schema_version mismatch", async () => {
    writeFileSync(join(work, "skillsh.json.gz"), gzipSync(Buffer.from(JSON.stringify({ schema_version: 99, skills: [] }))));
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
    rmSync(join(work, "skillsh.json.gz"));
    const r2 = await localQuery("pytest", 5);
    expect(r2.skills[0]!.name).toBe("pytest-helper");
  });

  it("__resetLocalIndexForTest forces a reload", async () => {
    const { localQuery, __resetLocalIndexForTest } = await import("@/core/local-query");
    await localQuery("pytest", 5);
    __resetLocalIndexForTest();
    rmSync(join(work, "skillsh.json.gz"));
    await expect(localQuery("pytest", 5)).rejects.toMatchObject({
      code: ERR.LOCAL_INDEX_BROKEN,
    });
  });
});
