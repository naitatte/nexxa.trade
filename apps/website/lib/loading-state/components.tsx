"use client";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { LoadingState } from "./types";

interface LoadingSpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function LoadingSpinner({ className, size = "md" }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "size-4",
    md: "size-6",
    lg: "size-8",
  };

  return (
    <Spinner className={cn(sizeClasses[size], className)} />
  );
}

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  className?: string;
}

export function LoadingOverlay({ isLoading, message, className }: LoadingOverlayProps) {
  if (!isLoading) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm",
        className
      )}
    >
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner size="lg" />
        {message && (
          <p className="text-sm text-muted-foreground">{message}</p>
        )}
      </div>
    </div>
  );
}

interface LoadingInlineProps {
  isLoading: boolean;
  message?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function LoadingInline({ isLoading, message, className, size = "md" }: LoadingInlineProps) {
  if (!isLoading) return null;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <LoadingSpinner size={size} />
      {message && (
        <span className="text-sm text-muted-foreground">{message}</span>
      )}
    </div>
  );
}

interface LoadingButtonProps {
  isLoading: boolean;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function LoadingButton({ isLoading, children, className, disabled }: LoadingButtonProps) {
  return (
    <button
      className={cn("flex items-center gap-2", className)}
      disabled={disabled || isLoading}
    >
      {isLoading && <LoadingSpinner size="sm" />}
      {children}
    </button>
  );
}

interface LoadingStateDisplayProps {
  state: LoadingState;
  message?: string;
  error?: Error | string;
  className?: string;
}

export function LoadingStateDisplay({ state, message, error, className }: LoadingStateDisplayProps) {
  if (state === "loading") {
    return <LoadingInline isLoading={true} message={message} className={className} />;
  }

  if (state === "error") {
    const errorMessage = error instanceof Error ? error.message : error || "An error occurred";
    return (
      <div className={cn("text-sm text-destructive", className)}>
        {errorMessage}
      </div>
    );
  }

  if (state === "success" && message) {
    return (
      <div className={cn("text-sm text-green-600 dark:text-green-400", className)}>
        {message}
      </div>
    );
  }

  return null;
}
