import { isAbsolute, join } from "node:path";
import * as fs from "node:fs";

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

export const SYMLINK_REJECTED = "SYMLINK_REJECTED";

// Recursively copy src into dst. Rejects ANY symlink in the subtree
// (throws Error(SYMLINK_REJECTED)). Includes dotfiles. Returns file count.
export function copyTreeNoSymlinks(src: string, dst: string): number {
  fs.mkdirSync(dst, { recursive: true });
  let count = 0;
  for (const dirent of fs.readdirSync(src, { withFileTypes: true })) {
    const from = join(src, dirent.name);
    const to = join(dst, dirent.name);
    if (dirent.isSymbolicLink()) {
      throw new Error(SYMLINK_REJECTED);
    }
    if (dirent.isDirectory()) {
      count += copyTreeNoSymlinks(from, to);
    } else if (dirent.isFile()) {
      fs.copyFileSync(from, to);
      count += 1;
    }
    // sockets/fifos/etc. are skipped silently
  }
  return count;
}
