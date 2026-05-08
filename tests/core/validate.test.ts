import { describe, expect, it } from "vitest";
import { validateName, parseOwner, validateRepoUrl, makeKey, parseRepoUrl } from "@/core/validate";
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

describe("parseRepoUrl", () => {
  it("parses root https URL", () => {
    const r = parseRepoUrl("https://github.com/foo/bar");
    expect(r.owner).toBe("foo");
    expect(r.cloneUrl).toBe("https://github.com/foo/bar");
    expect(r.subPath).toBeUndefined();
  });

  it("parses https URL with .git suffix", () => {
    const r = parseRepoUrl("https://github.com/foo/bar.git");
    expect(r.cloneUrl).toBe("https://github.com/foo/bar");
    expect(r.subPath).toBeUndefined();
  });

  it("parses sub-path tree URL", () => {
    const r = parseRepoUrl("https://github.com/foo/marketing-skills/tree/main/eeat-signals");
    expect(r.owner).toBe("foo");
    expect(r.cloneUrl).toBe("https://github.com/foo/marketing-skills");
    expect(r.subPath).toBe("eeat-signals");
  });

  it("parses nested sub-path tree URL", () => {
    const r = parseRepoUrl("https://github.com/foo/repo/tree/main/nested/skill");
    expect(r.cloneUrl).toBe("https://github.com/foo/repo");
    expect(r.subPath).toBe("nested/skill");
  });

  it("parses non-main branch tree URL", () => {
    const r = parseRepoUrl("https://github.com/foo/repo/tree/feature-branch/my-skill");
    expect(r.cloneUrl).toBe("https://github.com/foo/repo");
    expect(r.subPath).toBe("my-skill");
  });

  it("parses ssh URL", () => {
    const r = parseRepoUrl("git@github.com:foo/bar.git");
    expect(r.owner).toBe("foo");
    expect(r.cloneUrl).toBe("git@github.com:foo/bar");
    expect(r.subPath).toBeUndefined();
  });

  it("rejects /tree/<branch> without sub-path", () => {
    expect(() => parseRepoUrl("https://github.com/foo/bar/tree/main")).toThrow(DoraError);
  });

  it("rejects empty url", () => {
    expect(() => parseRepoUrl("")).toThrow(DoraError);
  });

  it("rejects non-github url", () => {
    expect(() => parseRepoUrl("https://gitlab.com/foo/bar")).toThrow(DoraError);
  });
});
