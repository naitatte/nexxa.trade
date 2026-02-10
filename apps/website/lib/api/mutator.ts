import { getApiBaseUrl } from "./base-url";

const API_BASE_URL = getApiBaseUrl();

export type RequestConfig = {
  url?: string;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  data?: unknown;
  params?: Record<string, string | number | boolean | null>;
  signal?: AbortSignal;
};

export const customInstance = async <T>(
  config: RequestConfig,
  options?: RequestInit,
): Promise<T> => {
  const urlPath = config.url || "";
  const url = urlPath.startsWith("http") ? urlPath : `${API_BASE_URL}${urlPath}`;

  const urlWithParams = new URL(url);
  if (config.params) {
    Object.entries(config.params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        urlWithParams.searchParams.append(key, String(value));
      }
    });
  }

  const { signal } = config;
  const hasBody = config.data !== undefined && config.data !== null;

  const response = await fetch(urlWithParams.toString(), {
    method: config.method || "GET",
    headers: {
      ...(hasBody && { "Content-Type": "application/json" }),
      ...config.headers,
    },
    body: hasBody ? JSON.stringify(config.data) : undefined,
    credentials: "include",
    signal: signal || options?.signal,
    ...options,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`API Error: ${response.status} ${errorText}`);
  }

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return response.json();
  }

  return response.text() as Promise<T>;
};

export default customInstance;
