import { describe, expect, it, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { handlers as mcpHandlers } from "@/mcp/tools";

let work: string;
let fixtureUrl: string;
const orig = { ...process.env };
const server = setupServer();

function makeRepo(parent: string): string {
  const dst = join(parent, "fixture-repo");
  mkdirSync(dst, { recursive: true });
  writeFileSync(join(dst, "SKILL.md"), "---\nname: e2e\n---\n# e2e fixture\n");
  execSync("git init -q && git add . && git -c user.email=t@d -c user.name=t commit -q -m init", { cwd: dst });
  return `file://${dst}`;
}

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterAll(() => server.close());

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), "dora-e2e-"));
  process.env.DORA_HOME = work;
  process.env.DORA_TEST = "1";
  fixtureUrl = makeRepo(work);
  server.use(http.post("http://127.0.0.1:8080/retrieve", () => HttpResponse.json({
    skills: [{ name: "e2e", url: fixtureUrl, security_level: "safe", description_en: "e2e", github_stars: 0 }],
  })));
});
afterEach(() => {
  server.resetHandlers();
  process.env = { ...orig };
  rmSync(work, { recursive: true, force: true });
});

describe("full flow", () => {
  it("query → load → touch → list → stats → purge", async () => {
    const q = JSON.parse(await mcpHandlers.dora_query({ query: "do e2e" }));
    expect(q.skills).toHaveLength(1);
    const cand = q.skills[0];

    const l = JSON.parse(await mcpHandlers.dora_load({
      name: cand.name, repo_url: cand.url, security_level: cand.security_level,
    }));
    expect(l.cache_hit).toBe(false);
    expect(l.key).toBe("e2e_local");

    const t = JSON.parse(await mcpHandlers.dora_touch({ key: l.key }));
    expect(t.ok).toBe(true);

    const list = await mcpHandlers.dora_list({});
    expect(list).toContain("e2e_local");

    const stats = await mcpHandlers.dora_stats({});
    expect(stats).toMatch(/Total cached:\s*1/);

    const p = JSON.parse(await mcpHandlers.dora_purge({ confirm: true }));
    expect(p.deleted_skills).toBe(1);
  });
});
