# RBAC with Better Auth in NexxaTrade

This project uses Better Auth's Access Control as the single source of truth for permissions.
There is no custom RBAC package; roles and permissions are defined on the server and queried
through the Better Auth API.

## Where it's defined

- Roles and permissions: `apps/server/src/features/auth/roles.ts`
  - `ROLE_PERMISSIONS` defines resources and actions per role.
  - `createAccessControlConfig()` builds the base permissions map (admin).
  - `createRoleConfig(role)` builds the permissions map per role.
  - `ac` and `roles` are passed to Better Auth's `admin` plugin.

- Better Auth configuration: `apps/server/src/features/auth/auth.ts`
  - Registers `admin({ ac, roles })` to enable access control.
  - Allowed roles live in `UserRole` (exported by `@nexxatrade/core`).
  - Additional user fields: `role`, `membershipStatus`, `membershipTier`,
    `membershipExpiresAt`.

- Shared role type: `packages/core/src/shared/roles.ts`
  - `USER_ROLES` and `UserRole` for consistent typing between server and website.

## How access is validated

In server routes, Better Auth APIs are used, for example:

- `auth.api.getSession(...)` to get the session.
- `auth.api.userHasPermission({ userId, permissions })` to validate permissions.

Real example: `apps/server/src/features/membership/routes.ts`.

## Summary flow

1) The permissions map per role is defined in `roles.ts`.
2) Better Auth creates the access control with `admin({ ac, roles })`.
3) Each route validates session and permissions via `auth.api.*`.
4) The website uses `UserRole` (from `@nexxatrade/core`) for UI/menus.

## How to extend

- Add new role: add to `UserRole` in `packages/core/src/shared/roles.ts` and
  update `ROLE_PERMISSIONS` in `apps/server/src/features/auth/roles.ts`.
- Add resource/action: edit `ROLE_PERMISSIONS` and adjust the UI if applicable.
