import { createAccessControl } from "better-auth/plugins";
import type { UserRole } from "@nexxatrade/core";
export type { UserRole } from "@nexxatrade/core";

const ROLE_PERMISSIONS = {
  admin: {
    signals: ["read", "write"],
    network: ["read", "manage"],
    withdrawals: ["create", "approve"],
    users: ["read", "manage"],
    membership: ["read", "manage"],
    retention: ["bypass_delete"],
  },
  subscriber: {
    signals: ["read"],
    network: ["read"],
    withdrawals: ["create"],
    membership: ["read"],
    users: [],
    retention: [],
  },
  networker: {
    signals: ["read"],
    network: ["read"],
    withdrawals: ["create"],
    membership: ["read"],
    users: [],
    retention: [],
  },
  guest: {
    signals: [],
    network: [],
    withdrawals: [],
    membership: ["read"],
    users: [],
    retention: [],
  },
} as const;

type Resource = keyof typeof ROLE_PERMISSIONS.admin;
type Action<R extends Resource> = (typeof ROLE_PERMISSIONS.admin)[R][number];

type RoleConfig = {
  [K in Resource]: Action<K>[];
};

function createAccessControlConfig() {
  const permissions: Record<string, string[]> = {};

  for (const [resource, actions] of Object.entries(ROLE_PERMISSIONS.admin)) {
    permissions[resource] = [...actions];
  }

  return permissions;
}

function createRoleConfig(role: UserRole): RoleConfig {
  const rolePermissions = ROLE_PERMISSIONS[role];
  const config: Record<string, string[]> = {};

  for (const [resource, actions] of Object.entries(rolePermissions)) {
    if (actions.length > 0) {
      config[resource] = [...actions];
    }
  }

  return config as RoleConfig;
}

export const permissions = createAccessControlConfig();

export const ac = createAccessControl(permissions);

export const adminRole = ac.newRole(createRoleConfig("admin"));
export const subscriberRole = ac.newRole(createRoleConfig("subscriber"));
export const networkerRole = ac.newRole(createRoleConfig("networker"));

export const roles = {
  admin: adminRole,
  subscriber: subscriberRole,
  networker: networkerRole,
} as const;
