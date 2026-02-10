import { db } from "../../config/db";
import { schema, eq } from "@nexxatrade/db";
import { ForbiddenError, NotFoundError } from "../../types/errors";
import type { Session } from "./auth";

const { user } = schema;

export type UserAccessState = {
  id: string;
  role: string;
  membershipStatus: string;
  twoFactorEnabled: boolean | null;
};

export async function getUserAccessState(userId: string): Promise<UserAccessState> {
  const rows = await db
    .select({
      id: user.id,
      role: user.role,
      membershipStatus: user.membershipStatus,
      twoFactorEnabled: user.twoFactorEnabled,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!rows.length) {
    throw new NotFoundError("User", userId);
  }

  return rows[0];
}

export async function requireActiveMembershipOrAdmin(
  session: Session,
  message: string = "Active membership required."
): Promise<UserAccessState> {
  const state = await getUserAccessState(session.user.id);
  if (state.role !== "admin" && state.membershipStatus !== "active") {
    throw new ForbiddenError(message);
  }
  return state;
}
