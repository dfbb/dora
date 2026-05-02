import { describe, expect, it } from "vitest";
import { DoraError, isDoraError, ERR } from "@/core/errors";

describe("DoraError", () => {
  it("carries code and detail", () => {
    const e = new DoraError(ERR.ENGINE_UNREACHABLE, "engine down", { url: "x" });
    expect(e.code).toBe("engine_unreachable");
    expect(e.message).toBe("engine down");
    expect(e.detail).toEqual({ url: "x" });
  });
  it("isDoraError narrows", () => {
    const e: unknown = new DoraError(ERR.NO_SKILL_MD, "x");
    expect(isDoraError(e)).toBe(true);
    expect(isDoraError(new Error("plain"))).toBe(false);
  });
  it("ERR has all spec error codes", () => {
    expect(ERR.ENGINE_UNREACHABLE).toBe("engine_unreachable");
    expect(ERR.HTTP_ERROR).toBe("http_error");
    expect(ERR.EMPTY_CANDIDATES).toBe("empty_candidates");
    expect(ERR.VALIDATION).toBe("validation");
    expect(ERR.CLONE_FAILED).toBe("clone_failed");
    expect(ERR.NO_SKILL_MD).toBe("no_skill_md");
    expect(ERR.STATUS_CORRUPT).toBe("status_corrupt");
    expect(ERR.CONFIRMATION_REQUIRED).toBe("confirmation_required");
  });
});
