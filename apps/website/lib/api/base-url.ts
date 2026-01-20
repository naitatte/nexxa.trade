const TRAILING_AUTH_PATH = /\/api\/auth\/?$/;

export function getApiBaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL || "").trim();
  if (raw) {
    return raw.replace(TRAILING_AUTH_PATH, "");
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  return siteUrl.replace(TRAILING_AUTH_PATH, "");
}
