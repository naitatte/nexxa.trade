"use client"

import { useState, useCallback } from "react";
import { toast } from "sonner";
import type { ErrorState, ErrorHandlerOptions, ErrorWithMetadata } from "./types";

export function useErrorState(options: ErrorHandlerOptions = {}) {
  const [errorState, setErrorState] = useState<ErrorState | null>(null);

  const setError = useCallback((error: Error | string, message?: string, code?: string | number, showToastOverride?: boolean) => {
    const errorObj: ErrorState = {
      error,
      message,
      code,
      timestamp: new Date(),
    };

    setErrorState(errorObj);

    const shouldShowToast = showToastOverride !== undefined ? showToastOverride : (options.showToast !== false);
    
    if (shouldShowToast) {
      const errorMessage = message || (error instanceof Error ? error.message : error) || "An error occurred";
      
      toast.error(errorMessage, {
        description: code ? `Error code: ${code}` : undefined,
        duration: 5000,
      });
    }

    if (options.logError !== false) {
      const errorToLog = error instanceof Error ? error : new Error(error);
      console.error("Error caught:", errorToLog, { message, code });
    }

    if (options.onError) {
      options.onError(error);
    }
  }, [options]);

  const clearError = useCallback(() => {
    setErrorState(null);
  }, []);

  const hasError = errorState !== null;

  const getErrorMessage = useCallback((fallback?: string): string => {
    if (!errorState) return fallback || options.fallbackMessage || "An error occurred";
    
    if (errorState.message) return errorState.message;
    
    if (errorState.error instanceof Error) {
      return errorState.error.message;
    }
    
    if (typeof errorState.error === "string") {
      return errorState.error;
    }
    
    return fallback || options.fallbackMessage || "An error occurred";
  }, [errorState, options.fallbackMessage]);

  const getError = useCallback((): Error | string | null => {
    return errorState?.error ?? null;
  }, [errorState]);

  return {
    errorState,
    hasError,
    error: errorState?.error ?? null,
    message: errorState?.message,
    code: errorState?.code,
    timestamp: errorState?.timestamp,
    setError,
    clearError,
    getErrorMessage,
    getError,
  };
}

export function useErrorHandler(options: ErrorHandlerOptions = {}) {
  const errorState = useErrorState(options);

  const handleError = useCallback((error: unknown) => {
    if (error instanceof Error) {
      const errorWithMetadata = error as ErrorWithMetadata;
      errorState.setError(
        error,
        error.message,
        errorWithMetadata.code
      );
    } else if (typeof error === "string") {
      errorState.setError(error);
    } else {
      errorState.setError("An unknown error occurred");
    }
  }, [errorState]);

  const handleAsyncError = useCallback(async <T,>(
    asyncFn: () => Promise<T>,
    errorMessage?: string
  ): Promise<T | null> => {
    try {
      return await asyncFn();
    } catch (error) {
      handleError(error);
      if (errorMessage) {
        errorState.setError(error instanceof Error ? error : new Error(String(error)), errorMessage);
      }
      return null;
    }
  }, [handleError, errorState]);

  return {
    ...errorState,
    handleError,
    handleAsyncError,
  };
}
