import { auth } from "./auth";
import { ForbiddenError } from "../../types/errors";

export type PermissionInput = Record<string, string[]>;

function parsePermissionResult(result: unknown): boolean {
  if (typeof result === "boolean") {
    return result;
  }

  if (result && typeof result === "object") {
    const record = result as { success?: boolean; data?: boolean };
    if (record.success === true) {
      return true;
    }
    if (record.data === true) {
      return true;
    }
  }

  return false;
}

export async function hasPermissions(
  userId: string,
  permissions: PermissionInput
): Promise<boolean> {
  const result: unknown = await auth.api.userHasPermission({
    body: {
      userId,
      permissions,
    },
  });

  return parsePermissionResult(result);
}

export async function requirePermissions(
  userId: string,
  permissions: PermissionInput,
  message: string = "Forbidden"
): Promise<void> {
  const allowed = await hasPermissions(userId, permissions);
  if (!allowed) {
    throw new ForbiddenError(message);
  }
}

export async function requirePermission(
  userId: string,
  resource: string,
  action: string,
  message: string = "Forbidden"
): Promise<void> {
  return requirePermissions(userId, { [resource]: [action] }, message);
}
