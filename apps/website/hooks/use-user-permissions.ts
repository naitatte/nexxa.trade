import { useSession } from "@/lib/auth/hooks";
import type { AuthUser } from "@/lib/auth/types";
import { 
  getUserPermissions, 
  type UserPermissions,
  type MembershipState,
  type UserRole,
  type UserWithRole 
} from "@/lib/auth/user-permissions";
import { useMemo } from "react";
import { useGetApiMembershipUsersUserId } from "@/lib/api/membership/membership";

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

function normalizeMembershipStatus(value: string | null | undefined): MembershipState | null {
  if (!value) {
    return null;
  }
  const normalized = value.toLowerCase();
  if (normalized === "active" || normalized === "inactive" || normalized === "deleted") {
    return normalized as MembershipState;
  }
  return null;
}

function resolveEffectiveRole(role: UserRole, membershipStatus: MembershipState | null): UserRole {
  if (role === "guest" && membershipStatus === "active") {
    return "subscriber";
  }
  return role;
}

export function useUserPermissions(): UserPermissions | null {
  const { data: session, isPending } = useSession();
  const userId = session?.user?.id;
  const { data: membershipData } = useGetApiMembershipUsersUserId(userId || "", {
    query: { enabled: !!userId }
  });

  return useMemo(() => {
    if (isPending) {
      return null;
    }

    if (!session?.user) {
      return null;
    }

    const user = session.user as AuthUser;
    const rawRole = extractUserRole(user);
    
    let expirationDate = extractExpirationDate(user);
    if (!expirationDate && membershipData?.expiresAt) {
      expirationDate = new Date(membershipData.expiresAt);
    }

    const membershipStatus =
      normalizeMembershipStatus(user.membershipStatus) ??
      normalizeMembershipStatus(membershipData?.status);
    const role = resolveEffectiveRole(rawRole, membershipStatus);

    return getUserPermissions(role, membershipStatus, expirationDate);
  }, [session, isPending, membershipData]);
}

export function useUser(): UserWithRole | null {
  const { data: session, isPending } = useSession();
  const userId = session?.user?.id;
  const { data: membershipData } = useGetApiMembershipUsersUserId(userId || "", {
    query: { enabled: !!userId }
  });

  return useMemo(() => {
    if (isPending || !session?.user) {
      return null;
    }

    const user = session.user as AuthUser;
    
    let expirationDate = extractExpirationDate(user);
    if (!expirationDate && membershipData?.expiresAt) {
      expirationDate = new Date(membershipData.expiresAt);
    }
    
    const membershipStatus =
      normalizeMembershipStatus(user.membershipStatus) ??
      normalizeMembershipStatus(membershipData?.status);
    const role = resolveEffectiveRole(extractUserRole(user), membershipStatus);

    return {
      id: user.id || "",
      name: user.name || "",
      email: user.email || "",
      role,
      expirationDate,
    };
  }, [session, isPending, membershipData]);
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
