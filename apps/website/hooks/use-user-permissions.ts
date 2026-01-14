import { useSession } from "@/lib/auth/hooks";
import type { AuthUser } from "@/lib/auth/types";
import { 
  getUserPermissions, 
  type UserPermissions,
  type UserRole,
  type UserWithRole 
} from "@/lib/auth/user-permissions";
import { useMemo } from "react";

function extractUserRole(user: AuthUser | null | undefined): UserRole {
  if (!user?.role) {
    return "guest";
  }

  const role = typeof user.role === "string" 
    ? user.role.toLowerCase() 
    : String(user.role).toLowerCase();
    
  if (["admin", "guest", "subscriber", "networker"].includes(role)) {
    return role as UserRole;
  }
  
  return "guest";
}

function extractExpirationDate(user: AuthUser | null | undefined): Date | null {
  if (!user) {
    return null;
  }

  if (user.expirationDate) {
    const date = new Date(user.expirationDate);
    return isNaN(date.getTime()) ? null : date;
  }
  
  if (user.membershipExpiresAt) {
    const date = new Date(user.membershipExpiresAt);
    return isNaN(date.getTime()) ? null : date;
  }
  
  return null;
}

export function useUserPermissions(): UserPermissions | null {
  const { data: session, isPending } = useSession();

  return useMemo(() => {
    if (isPending) {
      return null;
    }

    if (!session?.user) {
      return null;
    }

    const user = session.user;
    const role = extractUserRole(user);
    const expirationDate = extractExpirationDate(user);

    return getUserPermissions(role, expirationDate);
  }, [session, isPending]);
}

export function useUser(): UserWithRole | null {
  const { data: session, isPending } = useSession();

  return useMemo(() => {
    if (isPending || !session?.user) {
      return null;
    }

    const user = session.user;
    
    return {
      id: user.id || "",
      name: user.name || "",
      email: user.email || "",
      role: extractUserRole(user),
      expirationDate: extractExpirationDate(user),
    };
  }, [session, isPending]);
}

export function useHasRole(requiredRole: UserRole | UserRole[]): boolean {
  const user = useUser();
  
  if (!user) {
    return false;
  }

  if (Array.isArray(requiredRole)) {
    return requiredRole.includes(user.role);
  }

  return user.role === requiredRole;
}

export function useIsActive(): boolean {
  const permissions = useUserPermissions();
  return permissions?.status === "active" || false;
}
