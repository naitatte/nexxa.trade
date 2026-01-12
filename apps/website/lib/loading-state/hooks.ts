"use client"

import { useState, useCallback } from "react";
import { toast } from "sonner";
import type { LoadingState, LoadingStateConfig } from "./types";

export function useLoadingState(initialState: LoadingState = "idle") {
  const [state, setState] = useState<LoadingState>(initialState);
  const [config, setConfig] = useState<LoadingStateConfig>({});

  const setLoading = useCallback((message?: string) => {
    setState("loading");
    setConfig({ message });
    if (message) {
      toast.loading(message);
    }
  }, []);

  const setSuccess = useCallback((message?: string) => {
    setState("success");
    setConfig({ message });
    toast.dismiss(); // Dismiss any loading toasts
    if (message) {
      toast.success(message);
    }
  }, []);

  const setError = useCallback((error: Error | string, message?: string) => {
    setState("error");
    setConfig({ error, message });
    toast.dismiss(); // Dismiss any loading toasts
    const errorMessage = message || (error instanceof Error ? error.message : error) || "An error occurred";
    toast.error(errorMessage);
  }, []);

  const setIdle = useCallback(() => {
    setState("idle");
    setConfig({});
    toast.dismiss();
  }, []);

  const reset = useCallback(() => {
    setIdle();
  }, [setIdle]);

  return {
    state,
    config,
    isLoading: state === "loading",
    isSuccess: state === "success",
    isError: state === "error",
    isIdle: state === "idle",
    setLoading,
    setSuccess,
    setError,
    setIdle,
    reset,
  };
}
