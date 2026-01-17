import type { authClient } from "./client";
import type { UserRole } from "@/lib/auth/user-permissions";

export type AuthSession = ReturnType<(typeof authClient)["useSession"]>["data"];
export type AuthUser = NonNullable<AuthSession>["user"] & {
  role?: UserRole | string;
  expirationDate?: string | Date;
  membershipExpiresAt?: string | Date;
  membershipStatus?: string;
  membershipTier?: string;
};
