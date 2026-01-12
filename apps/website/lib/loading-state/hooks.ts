import { useState, useCallback } from "react";
import type { LoadingState, LoadingStateConfig } from "./types";

export function useLoadingState(initialState: LoadingState = "idle") {
  const [state, setState] = useState<LoadingState>(initialState);
  const [config, setConfig] = useState<LoadingStateConfig>({});

  const setLoading = useCallback((message?: string) => {
    setState("loading");
    setConfig({ message });
  }, []);

  const setSuccess = useCallback((message?: string) => {
    setState("success");
    setConfig({ message });
  }, []);

  const setError = useCallback((error: Error | string, message?: string) => {
    setState("error");
    setConfig({ error, message });
  }, []);

  const setIdle = useCallback(() => {
    setState("idle");
    setConfig({});
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
