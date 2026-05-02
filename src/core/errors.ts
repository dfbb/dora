export const ERR = {
  ENGINE_UNREACHABLE: "engine_unreachable",
  HTTP_ERROR: "http_error",
  EMPTY_CANDIDATES: "empty_candidates",
  VALIDATION: "validation",
  CLONE_FAILED: "clone_failed",
  NO_SKILL_MD: "no_skill_md",
  STATUS_CORRUPT: "status_corrupt",
  CONFIRMATION_REQUIRED: "confirmation_required",
} as const;

export type DoraErrorCode = (typeof ERR)[keyof typeof ERR];

export class DoraError extends Error {
  readonly code: DoraErrorCode;
  readonly detail?: Record<string, unknown>;
  constructor(code: DoraErrorCode, message: string, detail?: Record<string, unknown>) {
    super(message);
    this.name = "DoraError";
    this.code = code;
    this.detail = detail;
  }
  toJSON() {
    return { code: this.code, message: this.message, detail: this.detail };
  }
}

export function isDoraError(e: unknown): e is DoraError {
  return e instanceof DoraError;
}
