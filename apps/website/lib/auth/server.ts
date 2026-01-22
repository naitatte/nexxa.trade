const DEFAULT_AUTH_BASE_PATH = "/api/auth";
const AUTH_BASE_URL = process.env.NEXT_PUBLIC_BETTER_AUTH_URL || DEFAULT_AUTH_BASE_PATH;

const resolveAuthBaseUrl = (headers: Headers): string => {
  if (AUTH_BASE_URL.startsWith("http")) {
    return AUTH_BASE_URL.replace(/\/$/, "");
  }

  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  const proto = headers.get("x-forwarded-proto") ?? "http";
  const basePath = AUTH_BASE_URL.startsWith("/") ? AUTH_BASE_URL : `/${AUTH_BASE_URL}`;

  if (!host) {
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").trim();
    if (siteUrl) {
      return `${siteUrl.replace(/\/$/, "")}${basePath}`;
    }
    return basePath;
  }

  return `${proto}://${host}${basePath}`;
};

export type Session = {
  session: {
    id: string;
    expiresAt: Date;
    token: string;
    createdAt: Date;
    updatedAt: Date;
    ipAddress?: string;
    userAgent?: string;
    userId: string;
  };
  user: {
    id: string;
    name: string;
    username?: string | null;
    displayUsername?: string | null;
    email: string;
    emailVerified: boolean;
    image?: string;
    role: "admin" | "guest" | "subscriber" | "networker";
    twoFactorEnabled?: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
};

export async function getSession(options: { headers: Headers }): Promise<Session | null> {
  const cookieHeader = options.headers.get("cookie");

  if (!cookieHeader) {
    return null;
  }
  
  try {
    const authBaseUrl = resolveAuthBaseUrl(options.headers);
    const response = await fetch(`${authBaseUrl}/get-session`, {
      method: "GET",
      headers: {
        "cookie": cookieHeader,
      },
      credentials: "include",
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    if (!data || !data.user) {
      return null;
    }
    
    return data as Session;
  } catch {
    return null;
  }
}

export const auth = {
  api: {
    getSession: async (options: { headers: Headers }) => getSession(options),
  },
};
