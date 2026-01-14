"use client";

import { useUserPermissions } from "@/hooks/use-user-permissions";
import type { UserPermissions } from "@/lib/auth/user-permissions";
import { type ReactNode } from "react";

type WithPermissionsProps = {
  children: (permissions: UserPermissions) => ReactNode;
  fallback?: ReactNode;
};

export function WithPermissions({ children, fallback = null }: WithPermissionsProps) {
  const permissions = useUserPermissions();

  if (!permissions) {
    return <>{fallback}</>;
  }

  return <>{children(permissions)}</>;
}
