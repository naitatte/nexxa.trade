import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

const normalizeBaseUrl = (rawBaseUrl: string): string => {
  if (rawBaseUrl.startsWith("http")) {
    return rawBaseUrl.replace(/\/$/, "");
  }

  const basePath = rawBaseUrl.startsWith("/") ? rawBaseUrl : `/${rawBaseUrl}`;

  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${basePath}`;
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${siteUrl}${basePath}`;
};

const AUTH_BASE_URL = normalizeBaseUrl(
  process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "/api/auth",
);

export const authClient = createAuthClient({
  baseURL: AUTH_BASE_URL,
  plugins: [twoFactorClient()],
});
