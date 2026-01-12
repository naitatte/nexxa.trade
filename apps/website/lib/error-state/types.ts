export interface ErrorState {
  error: Error | string | null;
  message?: string;
  code?: string | number;
  timestamp?: Date;
}

export interface ErrorHandlerOptions {
  onError?: (error: Error | string) => void;
  fallbackMessage?: string;
  logError?: boolean;
}

export type ErrorSeverity = "low" | "medium" | "high" | "critical";

export interface ErrorWithMetadata extends Error {
  code?: string | number;
  severity?: ErrorSeverity;
  metadata?: Record<string, unknown>;
}
