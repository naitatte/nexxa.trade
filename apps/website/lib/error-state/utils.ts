import type { ErrorWithMetadata, ErrorSeverity } from "./types";

export function createError(
  message: string,
  code?: string | number,
  severity?: ErrorSeverity,
  metadata?: Record<string, unknown>
): ErrorWithMetadata {
  const error = new Error(message) as ErrorWithMetadata;
  error.code = code;
  error.severity = severity || "medium";
  error.metadata = metadata;
  return error;
}

export function isErrorWithMetadata(error: unknown): error is ErrorWithMetadata {
  return error instanceof Error && "code" in error;
}

export function getErrorCode(error: unknown): string | number | undefined {
  if (isErrorWithMetadata(error)) {
    return error.code;
  }
  return undefined;
}

export function getErrorSeverity(error: unknown): ErrorSeverity {
  if (isErrorWithMetadata(error)) {
    return error.severity || "medium";
  }
  return "medium";
}

export function getErrorMessage(error: unknown, fallback = "An error occurred"): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return fallback;
}

export function formatError(error: unknown): {
  message: string;
  code?: string | number;
  severity: ErrorSeverity;
  metadata?: Record<string, unknown>;
} {
  if (isErrorWithMetadata(error)) {
    return {
      message: error.message,
      code: error.code,
      severity: error.severity || "medium",
      metadata: error.metadata,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      severity: "medium",
    };
  }

  if (typeof error === "string") {
    return {
      message: error,
      severity: "medium",
    };
  }

  return {
    message: "An unknown error occurred",
    severity: "medium",
  };
}
