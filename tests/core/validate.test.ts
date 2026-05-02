import { describe, expect, it } from "vitest";
import { validateName, parseOwner, validateRepoUrl, makeKey } from "@/core/validate";
import { DoraError } from "@/core/errors";

describe("validateName", () => {
  it("accepts alphanumerics, dot, underscore, hyphen up to 64 chars", () => {
    expect(() => validateName("foo")).not.toThrow();
    expect(() => validateName("foo-bar.baz_1")).not.toThrow();
    expect(() => validateName("a".repeat(64))).not.toThrow();
  });
  it("rejects empty / too long / illegal chars", () => {
    expect(() => validateName("")).toThrow(DoraError);
    expect(() => validateName("a".repeat(65))).toThrow(DoraError);
    expect(() => validateName("foo bar")).toThrow(DoraError);
    expect(() => validateName("foo/bar")).toThrow(DoraError);
  });
});

describe("parseOwner", () => {
  it("extracts owner from https github URL", () => {
    expect(parseOwner("https://github.com/foo/bar")).toBe("foo");
    expect(parseOwner("https://github.com/foo/bar.git")).toBe("foo");
    expect(parseOwner("http://github.com/foo/bar/")).toBe("foo");
  });
  it("extracts owner from ssh github URL", () => {
    expect(parseOwner("git@github.com:foo/bar.git")).toBe("foo");
  });
  it("rejects non-github URLs", () => {
    expect(() => parseOwner("https://gitlab.com/foo/bar")).toThrow(DoraError);
    expect(() => parseOwner("https://github.com/foo/bar/tree/main")).toThrow(DoraError);
  });
});

describe("validateRepoUrl", () => {
  it("accepts github http/https/ssh", () => {
    expect(() => validateRepoUrl("https://github.com/foo/bar")).not.toThrow();
    expect(() => validateRepoUrl("git@github.com:foo/bar.git")).not.toThrow();
  });
  it("rejects everything else", () => {
    expect(() => validateRepoUrl("https://gitlab.com/foo/bar")).toThrow(DoraError);
    expect(() => validateRepoUrl("file:///tmp/repo")).toThrow(DoraError);
  });
});

describe("makeKey", () => {
  it("joins skill_name and owner with underscore", () => {
    expect(makeKey("foo-skill", "alice")).toBe("foo-skill_alice");
  });
});
