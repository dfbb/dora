import { DoraError, ERR } from "./errors";

const NAME_RE = /^[a-zA-Z0-9._-]{1,64}$/;
const GH_HTTPS = /^https?:\/\/github\.com\/([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)\/([a-zA-Z0-9._-]+?)(?:\.git)?\/?$/;
const GH_HTTPS_TREE = /^https?:\/\/github\.com\/([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)\/([a-zA-Z0-9._-]+?)\/tree\/[^/]+\/(.+?)\/?$/;
const GH_SSH = /^git@github\.com:([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)\/([a-zA-Z0-9._-]+?)(?:\.git)?$/;

export interface ParsedRepoUrl {
  owner: string;
  cloneUrl: string;
  subPath?: string;
}

export function parseRepoUrl(url: string): ParsedRepoUrl {
  if (!url) throw new DoraError(ERR.VALIDATION, "empty repo url");
  let m = GH_HTTPS.exec(url);
  if (m) return { owner: m[1]!, cloneUrl: `https://github.com/${m[1]}/${m[2]}` };
  m = GH_HTTPS_TREE.exec(url);
  if (m) return { owner: m[1]!, cloneUrl: `https://github.com/${m[1]}/${m[2]}`, subPath: m[3] };
  m = GH_SSH.exec(url);
  if (m) return { owner: m[1]!, cloneUrl: `git@github.com:${m[1]}/${m[2]}` };
  throw new DoraError(ERR.VALIDATION, `unrecognized github url: ${JSON.stringify(url)}`);
}

export function validateName(name: string): void {
  if (!NAME_RE.test(name)) {
    throw new DoraError(ERR.VALIDATION, `invalid skill name: ${JSON.stringify(name)}`);
  }
}

export function parseOwner(url: string): string {
  for (const re of [GH_HTTPS, GH_SSH]) {
    const m = re.exec(url);
    if (m) return m[1]!;
  }
  throw new DoraError(ERR.VALIDATION, `unrecognized github url: ${JSON.stringify(url)}`);
}

export function validateRepoUrl(url: string): void {
  if (!url) throw new DoraError(ERR.VALIDATION, "empty repo url");
  parseOwner(url);
}

export function makeKey(skillName: string, owner: string): string {
  return `${skillName}_${owner}`;
}
