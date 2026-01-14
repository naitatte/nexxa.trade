import { createAccessControl } from "better-auth/plugins";

export const permissions = {
  signals: ["read", "write"],
  network: ["read"],
  withdrawals: ["create", "approve"],
  users: ["read"],
  membership: ["manage"],
  retention: ["bypass_delete"],
} as const;

export const ac = createAccessControl(permissions);

export const adminRole = ac.newRole({
  signals: ["read", "write"],
  network: ["read"],
  withdrawals: ["create", "approve"],
  users: ["read"],
  membership: ["manage"],
  retention: ["bypass_delete"],
});

export const subscriberRole = ac.newRole({
  signals: ["read"],
  network: ["read"],
  withdrawals: ["create"],
  membership: ["manage"],
});

export const networkerRole = ac.newRole({
  signals: ["read"],
  network: ["read"],
  withdrawals: ["create"],
  membership: ["manage"],
});

export const roles = {
  admin: adminRole,
  subscriber: subscriberRole,
  networker: networkerRole,
} as const;

export type UserRole = "admin" | "guest" | "subscriber" | "networker";
