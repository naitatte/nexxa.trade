"use client";

import { useHasRole, useIsActive, useUserPermissions } from "@/hooks/use-user-permissions";
import type { UserRole } from "@/lib/auth/user-permissions";
import { type ReactNode } from "react";

type RoleGuardProps = {
  children: ReactNode;
  allowedRoles: UserRole | UserRole[];
  fallback?: ReactNode;
  requireActive?: boolean;
};

export function RoleGuard({ 
  children, 
  allowedRoles, 
  fallback = null,
  requireActive = false 
}: RoleGuardProps) {
  const hasRole = useHasRole(allowedRoles);
  const isActive = useIsActive();
  if (requireActive && !isActive) {
    return <>{fallback}</>;
  }

  if (!hasRole) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

type ActiveGuardProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

export function ActiveGuard({ children, fallback = null }: ActiveGuardProps) {
  const isActive = useIsActive();

  if (!isActive) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

type PermissionGuardProps = {
  children: ReactNode;
  fallback?: ReactNode;
  check: (permissions: ReturnType<typeof useUserPermissions>) => boolean;
};

export function PermissionGuard({ 
  children, 
  fallback = null,
  check 
}: PermissionGuardProps) {
  const permissions = useUserPermissions();

  if (!permissions || !check(permissions)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
