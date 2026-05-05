import { describe, expect, it, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { queryEngine } from "@/core/query";
import { DoraError, ERR } from "@/core/errors";
import { readRecentQueryLog } from "@/core/log";

const ENGINE = "http://test-engine.local";
const server = setupServer();
let work: string;
const orig = { ...process.env };

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), "dora-query-"));
  process.env.DORA_HOME = work;
  server.resetHandlers();
});
afterEach(() => {
  process.env = { ...orig };
  rmSync(work, { recursive: true, force: true });
});

describe("queryEngine", () => {
  it("returns skills array on 200", async () => {
    server.use(http.post(`${ENGINE}/retrieve`, () => HttpResponse.json({
      skills: [{ name: "x", url: "https://github.com/a/b", security_level: "safe" }],
    })));
    const out = await queryEngine("hi", { url: ENGINE, timeoutMs: 5000 });
    expect(out.skills).toHaveLength(1);
  });

  it("logs candidate count after success", async () => {
    server.use(http.post(`${ENGINE}/retrieve`, () => HttpResponse.json({
      skills: [{ name: "x" }, { name: "y" }],
    })));
    await queryEngine("hi", { url: ENGINE, timeoutMs: 5000 });
    const rows = readRecentQueryLog(10);
    expect(rows[0]!.candidate_count).toBe(2);
  });

  it("throws ENGINE_UNREACHABLE on network error", async () => {
    server.use(http.post(`${ENGINE}/retrieve`, () => HttpResponse.error()));
    await expect(queryEngine("hi", { url: ENGINE, timeoutMs: 5000 }))
      .rejects.toMatchObject({ code: ERR.ENGINE_UNREACHABLE });
  });

  it("throws HTTP_ERROR on 5xx", async () => {
    server.use(http.post(`${ENGINE}/retrieve`, () => new HttpResponse("boom", { status: 502 })));
    await expect(queryEngine("hi", { url: ENGINE, timeoutMs: 5000 }))
      .rejects.toMatchObject({ code: ERR.HTTP_ERROR });
  });

  it("throws EMPTY_CANDIDATES when skills array empty", async () => {
    server.use(http.post(`${ENGINE}/retrieve`, () => HttpResponse.json({ skills: [] })));
    await expect(queryEngine("hi", { url: ENGINE, timeoutMs: 5000 }))
      .rejects.toMatchObject({ code: ERR.EMPTY_CANDIDATES });
  });
});
