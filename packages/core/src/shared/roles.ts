export const USER_ROLES = ["admin", "guest", "subscriber", "networker"] as const;

export type UserRole = (typeof USER_ROLES)[number];
