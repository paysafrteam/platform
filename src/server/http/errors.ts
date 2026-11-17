import "server-only";

export type ErrorCode =
  | "VALIDATION" | "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "RATE_LIMITED"
  | "EMAIL_NOT_VERIFIED" | "INVALID_CODE" | "INVALID_STATE" | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION: 400, UNAUTHENTICATED: 401, FORBIDDEN: 403, NOT_FOUND: 404, CONFLICT: 409,
  RATE_LIMITED: 429, EMAIL_NOT_VERIFIED: 403, INVALID_CODE: 400, INVALID_STATE: 409, INTERNAL: 500,
};

export class AppError extends Error {
  readonly status: number;
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly fields?: Record<string, string>,
    public readonly extra?: { retryAfterSeconds?: number },
  ) {
    super(message);
    this.status = STATUS[code];
  }
}

export function toResponse(error: unknown, requestId: string): Response {
  if (error instanceof AppError) {
    const headers = new Headers({ "x-request-id": requestId });
    if (error.extra?.retryAfterSeconds) headers.set("retry-after", String(error.extra.retryAfterSeconds));
    return Response.json(
      { error: { code: error.code, message: error.message, ...(error.fields ? { fields: error.fields } : {}), ...(error.extra ?? {}) } },
      { status: error.status, headers },
    );
  }
  console.error(`[api ${requestId}]`, error instanceof Error ? error.message : "unknown error");
  return Response.json(
    { error: { code: "INTERNAL", message: "Something went wrong on our side. Please try again." } },
    { status: 500, headers: { "x-request-id": requestId } },
  );
}
