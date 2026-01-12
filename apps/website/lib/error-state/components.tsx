"use client";

import * as React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { AlertCircle, X } from "lucide-react";
import type { ErrorState } from "./types";

interface ErrorAlertProps {
  error: Error | string | null;
  message?: string;
  onDismiss?: () => void;
  className?: string;
  variant?: "default" | "destructive";
  showIcon?: boolean;
}

export function ErrorAlert({
  error,
  message,
  onDismiss,
  className,
  variant = "destructive",
  showIcon = true,
}: ErrorAlertProps) {
  if (!error) return null;

  const errorMessage = message || (error instanceof Error ? error.message : error);

  return (
    <Alert variant={variant} className={cn("relative", className)}>
      {showIcon && <AlertCircle className="size-4" />}
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>{errorMessage}</AlertDescription>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </button>
      )}
    </Alert>
  );
}

interface ErrorDisplayProps {
  errorState: ErrorState | null;
  onDismiss?: () => void;
  className?: string;
  fallbackMessage?: string;
}

export function ErrorDisplay({
  errorState,
  onDismiss,
  className,
  fallbackMessage,
}: ErrorDisplayProps) {
  if (!errorState || !errorState.error) return null;

  return (
    <ErrorAlert
      error={errorState.error}
      message={errorState.message || fallbackMessage}
      onDismiss={onDismiss}
      className={className}
    />
  );
}

interface ErrorInlineProps {
  error: Error | string | null;
  message?: string;
  className?: string;
}

export function ErrorInline({ error, message, className }: ErrorInlineProps) {
  if (!error) return null;

  const errorMessage = message || (error instanceof Error ? error.message : error);

  return (
    <div className={cn("text-sm text-destructive", className)}>
      {errorMessage}
    </div>
  );
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
      }

      return (
        <ErrorAlert
          error={this.state.error}
          message={this.state.error.message}
        />
      );
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
  title?: string;
  message?: string;
}

export function ErrorFallback({ error, resetError, title, message }: ErrorFallbackProps) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8">
      <Alert variant="destructive" className="max-w-md">
        <AlertCircle className="size-4" />
        <AlertTitle>{title || "Something went wrong"}</AlertTitle>
        <AlertDescription>
          {message || error.message || "An unexpected error occurred"}
        </AlertDescription>
      </Alert>
      <button
        onClick={resetError}
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
      >
        Try again
      </button>
    </div>
  );
}
