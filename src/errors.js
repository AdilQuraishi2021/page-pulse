export class AppError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function errorResponse(error, requestId) {
  const status = error instanceof AppError ? error.status : 500;
  const code = error instanceof AppError ? error.code : "INTERNAL_ERROR";
  const message = error instanceof AppError ? error.message : "Unexpected server error";
  const body = {
    ok: false,
    requestId,
    error: { code, message }
  };

  if (error instanceof AppError && error.details) {
    body.error.details = error.details;
  }

  return { status, body };
}
