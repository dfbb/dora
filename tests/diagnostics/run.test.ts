import { describe, expect, it } from "vitest";
import { renderChecklist } from "@/diagnostics/run";

describe("renderChecklist", () => {
  it("renders pass/fail/warn glyphs", () => {
    const md = renderChecklist([
      { name: "Node 18+", status: "pass", detail: "v22.4.0" },
      { name: "git available", status: "pass", detail: "2.42.0" },
      { name: "engine reachable", status: "fail", detail: "ECONNREFUSED" },
      { name: "hook installed", status: "warn", detail: "skipped (Cursor)" },
    ]);
    expect(md).toContain("## dora doctor");
    expect(md).toContain("- [x] Node 18+ (v22.4.0)");
    expect(md).toContain("- [ ] engine reachable (ECONNREFUSED)");
    expect(md).toContain("- [-] hook installed (skipped (Cursor))");
  });
});
