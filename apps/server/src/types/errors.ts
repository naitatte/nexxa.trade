export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AppError";
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, "VALIDATION_ERROR", message, details);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    super(
      404,
      "NOT_FOUND",
      `${resource}${identifier ? ` with identifier ${identifier}` : ""} not found`
    );
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(401, "UNAUTHORIZED", message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(403, "FORBIDDEN", message);
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(409, "CONFLICT", message, details);
    this.name = "ConflictError";
  }
}

export class InternalServerError extends AppError {
  constructor(message = "Internal server error", details?: unknown) {
    super(500, "INTERNAL_SERVER_ERROR", message, details);
    this.name = "InternalServerError";
  }
}
