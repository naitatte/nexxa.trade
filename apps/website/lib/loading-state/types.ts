export type LoadingState = "idle" | "loading" | "success" | "error";

export interface LoadingStateConfig {
  message?: string;
  error?: Error | string;
}
