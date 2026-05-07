import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { handlers, createHandlers } from "@/mcp/tools";
import { writeStatus } from "@/core/status";
import { ERR } from "@/core/errors";

const server = setupServer();
let work: string;
const origDoraHome = process.env.DORA_HOME;
const origDoraTest = process.env.DORA_TEST;

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), "dora-mcp-"));
  process.env.DORA_HOME = work;
  process.env.DORA_TEST = "1";
  server.listen({ onUnhandledRequest: "bypass" });
});
afterEach(() => {
  if (origDoraHome === undefined) delete process.env.DORA_HOME; else process.env.DORA_HOME = origDoraHome;
  if (origDoraTest === undefined) delete process.env.DORA_TEST; else process.env.DORA_TEST = origDoraTest;
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

describe("createHandlers with platform context", () => {
  it("dora_load returns execution_context and detected_platform for codex", async () => {
    const h = createHandlers({
      getDetection: () => ({ platform: "codex" as const, source: "env-override" as const }),
    });

    const skillDir = join(work, "skills", "testskill_local");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "# test");
    writeStatus({
      version: 1,
      skills: {
        testskill_local: {
          skill_name: "testskill", owner: "local",
          repo_url: "file:///tmp/test",
          github_hash: "abc", primary_skill_path: "SKILL.md",
          security_level: "safe",
          downloaded_at: new Date().toISOString(),
          last_used_at: new Date().toISOString(),
          use_count: 0,
        },
      },
    });

    const out = JSON.parse(
      await h.dora_load({
        name: "testskill",
        repo_url: "file:///tmp/test",
        security_level: "safe",
      }),
    );
    expect(out.detected_platform).toBe("codex");
    expect(out.detection_source).toBe("env-override");
    expect(out.execution_context).toContain("native file tools");
    expect(typeof out.execution_context).toBe("string");
  });

  it("dora_load returns warning execution_context for unknown platform", async () => {
    const h = createHandlers({
      getDetection: () => ({
        platform: "unknown" as const,
        source: "env-override" as const,
        warning: 'invalid DORA_PLATFORM value: "nope"',
      }),
    });

    const skillDir = join(work, "skills", "testskill_local");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "# test");
    writeStatus({
      version: 1,
      skills: {
        testskill_local: {
          skill_name: "testskill", owner: "local",
          repo_url: "file:///tmp/test",
          github_hash: "abc", primary_skill_path: "SKILL.md",
          security_level: "safe",
          downloaded_at: new Date().toISOString(),
          last_used_at: new Date().toISOString(),
          use_count: 0,
        },
      },
    });

    const out = JSON.parse(
      await h.dora_load({
        name: "testskill",
        repo_url: "file:///tmp/test",
        security_level: "safe",
      }),
    );
    expect(out.detected_platform).toBe("unknown");
    expect(out.detection_source).toBe("env-override");
    expect(out.execution_context).toContain("⚠️");
    expect(out.execution_context).toContain("nope");
    expect(out.execution_context).toContain("Platform Adaptation Warning");
  });

  it("dora_load returns null execution_context for claude-code", async () => {
    const h = createHandlers({
      getDetection: () => ({ platform: "claude-code" as const, source: "env-signal" as const }),
    });

    const skillDir = join(work, "skills", "testskill_local");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "# test");
    writeStatus({
      version: 1,
      skills: {
        testskill_local: {
          skill_name: "testskill", owner: "local",
          repo_url: "file:///tmp/test",
          github_hash: "abc", primary_skill_path: "SKILL.md",
          security_level: "safe",
          downloaded_at: new Date().toISOString(),
          last_used_at: new Date().toISOString(),
          use_count: 0,
        },
      },
    });

    const out = JSON.parse(
      await h.dora_load({
        name: "testskill",
        repo_url: "file:///tmp/test",
        security_level: "safe",
      }),
    );
    expect(out.detected_platform).toBe("claude-code");
    expect(out.detection_source).toBe("env-signal");
    expect(out.execution_context).toBeNull();
  });
});
