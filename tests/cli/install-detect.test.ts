import { describe, expect, it } from "vitest";
import { detectInstallTarget, INSTALL_TARGETS } from "@/platforms/detect";

describe("detectInstallTarget", () => {
  it("explicit argument returns target", () => {
    const r = detectInstallTarget(["codex"], {});
    expect(r).toEqual({ ok: true, target: "codex" });
  });

  it("explicit argument not in list returns invalid-platform", () => {
    const r = detectInstallTarget(["foo"], {});
    expect(r).toEqual({ ok: false, reason: "invalid-platform", value: "foo" });
  });

  it("claude-code returns unsupported-install-target", () => {
    const r = detectInstallTarget(["claude-code"], {});
    expect(r.ok).toBe(false);
    expect((r as any).reason).toBe("unsupported-install-target");
    expect((r as any).hint).toContain("plugin marketplace");
  });

  it("DORA_PLATFORM=claude-code without explicit arg returns unsupported", () => {
    const r = detectInstallTarget([], { DORA_PLATFORM: "claude-code" });
    expect(r.ok).toBe(false);
    expect((r as any).reason).toBe("unsupported-install-target");
  });

  it("CLAUDE_PROJECT_DIR env returns unsupported", () => {
    const r = detectInstallTarget([], { CLAUDE_PROJECT_DIR: "/tmp" });
    expect(r.ok).toBe(false);
    expect((r as any).reason).toBe("unsupported-install-target");
  });

  it("DORA_PLATFORM=codex without explicit arg returns codex", () => {
    const r = detectInstallTarget([], { DORA_PLATFORM: "codex" });
    expect(r).toEqual({ ok: true, target: "codex" });
  });

  it("DORA_PLATFORM=invalid returns invalid-platform", () => {
    const r = detectInstallTarget([], { DORA_PLATFORM: "nope" });
    expect(r).toEqual({ ok: false, reason: "invalid-platform", value: "nope" });
  });

  it("CODEX_THREAD_ID env signal returns codex", () => {
    const r = detectInstallTarget([], { CODEX_THREAD_ID: "abc" });
    expect(r).toEqual({ ok: true, target: "codex" });
  });

  it("no signals returns no-signal", () => {
    const r = detectInstallTarget([], {});
    expect(r).toEqual({ ok: false, reason: "no-signal" });
  });

  it("INSTALL_TARGETS is runtime accessible array", () => {
    expect(Array.isArray(INSTALL_TARGETS)).toBe(true);
    expect(INSTALL_TARGETS).toContain("codex");
    expect(INSTALL_TARGETS).not.toContain("claude-code");
  });
});
