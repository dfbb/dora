import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { handlers } from "@/mcp/tools";
import { writeStatus } from "@/core/status";
import { ERR } from "@/core/errors";

const server = setupServer();
let work: string;
const orig = { ...process.env };

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), "dora-mcp-"));
  process.env.DORA_HOME = work;
  process.env.DORA_TEST = "1";
  server.listen({ onUnhandledRequest: "bypass" });
});
afterEach(() => {
  process.env = { ...orig };
  server.close();
  rmSync(work, { recursive: true, force: true });
});

describe("MCP tool handlers", () => {
  it("dora_query returns skills", async () => {
    server.use(http.post("http://api.doraskill.org/retrieve", () =>
      HttpResponse.json({ skills: [{ name: "x", url: "https://github.com/a/x", security_level: "safe" }] })));
    const r = await handlers.dora_query({ query: "hello" });
    expect(JSON.parse(r).skills).toHaveLength(1);
  });

  it("dora_purge requires confirm:true", async () => {
    const r = await handlers.dora_purge({ confirm: false });
    expect(JSON.parse(r).error).toBe(ERR.CONFIRMATION_REQUIRED);
  });

  it("dora_touch errors on unknown key", async () => {
    const r = await handlers.dora_touch({ key: "nope_x" });
    expect(JSON.parse(r).error).toBeDefined();
  });

  it("dora_list returns text table", async () => {
    mkdirSync(join(work, "skills", "foo_alice"), { recursive: true });
    writeFileSync(join(work, "skills", "foo_alice", "SKILL.md"), "# foo");
    writeStatus({
      version: 1,
      skills: { "foo_alice": {
        skill_name: "foo", owner: "alice",
        repo_url: "https://github.com/alice/foo",
        github_hash: "x", primary_skill_path: "SKILL.md",
        security_level: "safe", downloaded_at: new Date().toISOString(),
        last_used_at: new Date().toISOString(), use_count: 0,
      }},
    });
    const r = await handlers.dora_list({});
    expect(r).toContain("foo_alice");
  });
});
