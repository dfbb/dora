import { isAbsolute } from "node:path";

/**
 * Guards a cache key (`<skillName>_<owner>` from the untrusted status.yaml)
 * before it is used to build a filesystem path. Rejects empty, the `.`/`..`
 * segments, absolute paths, and any path separator. A `..` *substring* inside
 * a single segment (e.g. `foo_..`) is allowed — only a whole `..` segment
 * traverses upward.
 */
export function isSafeCacheKey(key: string): boolean {
  if (!key) return false;
  if (key === "." || key === "..") return false;
  if (isAbsolute(key)) return false; // belt-and-suspenders: also covers Windows drive/UNC absolute forms
  if (key.includes("/") || key.includes("\\")) return false;
  return true;
}
