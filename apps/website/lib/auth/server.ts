const AUTH_BASE_URL = process.env.NEXT_PUBLIC_BETTER_AUTH_URL;

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
    email: string;
    emailVerified: boolean;
    image?: string;
    role: "admin" | "guest" | "subscriber" | "networker";
    createdAt: Date;
    updatedAt: Date;
  };
};

export async function getSession(options: { headers: Headers }): Promise<Session | null> {
  const cookieHeader = options.headers.get("cookie");
  
  if (!cookieHeader || !cookieHeader.includes("better-auth.session_token")) {
    return null;
  }
  
  try {
    const response = await fetch(`${AUTH_BASE_URL}/get-session`, {
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
