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

  it("C3: remote 404 -> falls back to local", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    server.use(http.post(`${ENGINE}/retrieve`, () => new HttpResponse("not found", { status: 404 })));
    localQueryMock.mockResolvedValue({ skills: [{ name: "local-404" }], source: "local" });
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

  it.each([401, 403])("D2: remote %i -> NOT a fallback", async (status) => {
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
