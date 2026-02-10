import { db } from "../../config/db";
import { schema, eq, sql } from "@nexxatrade/db";
import type { MembershipStatus } from "@nexxatrade/core";
import { ValidationError } from "../../types/errors";
import { createMailerFromEnv, getInactiveSponsorReferralTemplate } from "@nexxatrade/mail";
import { env } from "../../config/env";
import { MEMBERSHIP_DELETION_DAYS } from "../membership/config";

const { user, referral } = schema;

const mailer = createMailerFromEnv(env.SMTP_FROM);

type Database = typeof db;
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbLike = Database | Transaction;

export type SponsorInfo = {
  id: string;
  name: string | null;
  email: string;
  username: string | null;
  membershipStatus: MembershipStatus;
};

export type ReferredUserInfo = {
  id: string;
  name: string | null;
  email: string;
  username?: string | null;
};

export async function resolveSponsorByRefCode(
  refCode: string,
  tx: DbLike = db
): Promise<SponsorInfo> {
  const normalized = refCode.trim();
  if (!normalized) {
    throw new ValidationError("Invalid referral code.");
  }
  const sponsorRows = await tx
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      membershipStatus: user.membershipStatus,
    })
    .from(user)
    .where(eq(user.username, normalized))
    .limit(1);

  if (!sponsorRows.length) {
    throw new ValidationError("Invalid referral code.");
  }

  const sponsor = sponsorRows[0];
  if (sponsor.membershipStatus === "deleted") {
    throw new ValidationError("Invalid referral code.");
  }

  return sponsor;
}

export async function upsertReferralLink(input: {
  userId: string;
  sponsorId?: string | null;
  tx?: DbLike;
  now?: Date;
}): Promise<void> {
  const { userId, sponsorId = null, tx = db, now = new Date() } = input;

  const existing = await tx
    .select({ sponsorId: referral.sponsorId })
    .from(referral)
    .where(eq(referral.userId, userId))
    .limit(1);

  if (!existing.length) {
    await tx.insert(referral).values({
      userId,
      sponsorId,
      createdAt: now,
      updatedAt: now,
    });
    return;
  }

  const currentSponsorId = existing[0]?.sponsorId ?? null;
  if (currentSponsorId || !sponsorId) {
    return;
  }

  await tx
    .update(referral)
    .set({ sponsorId, updatedAt: now })
    .where(eq(referral.userId, userId));
}

export async function sendInactiveSponsorReferralNotice(input: {
  sponsor: SponsorInfo;
  referred: ReferredUserInfo;
}): Promise<void> {
  const { sponsor, referred } = input;
  const displayName = sponsor.name || sponsor.username || undefined;
  const referredLabel = referred.username
    ? `@${referred.username}`
    : referred.name || referred.email;
  const sponsorCode = sponsor.username || sponsor.email;
  const template = getInactiveSponsorReferralTemplate(
    "NexxaTrade",
    sponsorCode,
    referredLabel,
    displayName
  );
  await mailer.sendMail({
    to: sponsor.email,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
}

export type ReferralStats = {
  directPartners: number;
  totalTeam: number;
  activeMembers: number;
  atRiskMembers: number;
};

export async function getReferralStats(userId: string): Promise<ReferralStats> {
  const directResult = await db.execute(sql`
    SELECT
      COUNT(*)::int AS "total",
      COUNT(*) FILTER (WHERE usr.membership_status = 'active')::int AS "active",
      COUNT(*) FILTER (
        WHERE usr.membership_status = 'inactive'
        AND m.inactive_at IS NOT NULL
        AND m.inactive_at > NOW() - INTERVAL '${sql.raw(String(MEMBERSHIP_DELETION_DAYS))} days'
      )::int AS "atRisk"
    FROM referral r
    JOIN "user" usr ON usr.id = r.user_id
    LEFT JOIN membership m ON m.user_id = r.user_id
    WHERE r.sponsor_id = ${userId}
      AND usr.membership_status != 'deleted'
  `);
  const direct = (directResult as unknown as Array<{ total: number; active: number; atRisk: number }>)[0]
    ?? { total: 0, active: 0, atRisk: 0 };
  const teamResult = await db.execute(sql`
    WITH RECURSIVE downline AS (
      SELECT r.user_id, 1 AS level
      FROM referral r
      WHERE r.sponsor_id = ${userId}
      UNION ALL
      SELECT r.user_id, d.level + 1 AS level
      FROM referral r
      JOIN downline d ON r.sponsor_id = d.user_id
      WHERE d.level < 7
    )
    SELECT
      COUNT(*)::int AS "total",
      COUNT(*) FILTER (WHERE usr.membership_status = 'active')::int AS "active",
      COUNT(*) FILTER (
        WHERE usr.membership_status = 'inactive'
        AND m.inactive_at IS NOT NULL
        AND m.inactive_at > NOW() - INTERVAL '${sql.raw(String(MEMBERSHIP_DELETION_DAYS))} days'
      )::int AS "atRisk"
    FROM downline d
    JOIN "user" usr ON usr.id = d.user_id
    LEFT JOIN membership m ON m.user_id = d.user_id
    WHERE usr.membership_status != 'deleted'
  `);
  const team = (teamResult as unknown as Array<{ total: number; active: number; atRisk: number }>)[0]
    ?? { total: 0, active: 0, atRisk: 0 };
  return {
    directPartners: direct.total,
    totalTeam: team.total,
    activeMembers: team.active,
    atRiskMembers: team.atRisk,
  };
}

export type ReferralTeamMember = {
  id: string;
  name: string;
  username: string | null;
  email: string;
  membershipStatus: MembershipStatus;
  joinedAt: string;
  level: number;
  totalEarnedUsdCents: number;
};

type ReferralTeamResult = {
  items: ReferralTeamMember[];
  total: number;
  page: number;
  pageSize: number;
};

export async function getReferralTeam(input: {
  userId: string;
  page?: number;
  pageSize?: number;
  statusFilter?: string;
}): Promise<ReferralTeamResult> {
  const { userId, page = 1, pageSize = 10, statusFilter } = input;
  const offset = (page - 1) * pageSize;
  const statusClause = statusFilter === "at_risk"
    ? sql`AND usr.membership_status = 'inactive' AND m.inactive_at IS NOT NULL AND m.inactive_at > NOW() - INTERVAL '${sql.raw(String(MEMBERSHIP_DELETION_DAYS))} days'`
    : sql``;
  const countResult = await db.execute(sql`
    WITH RECURSIVE downline AS (
      SELECT r.user_id, 1 AS level
      FROM referral r
      WHERE r.sponsor_id = ${userId}
      UNION ALL
      SELECT r.user_id, d.level + 1 AS level
      FROM referral r
      JOIN downline d ON r.sponsor_id = d.user_id
      WHERE d.level < 7
    )
    SELECT COUNT(*)::int AS "total"
    FROM downline d
    JOIN "user" usr ON usr.id = d.user_id
    LEFT JOIN membership m ON m.user_id = d.user_id
    WHERE usr.membership_status != 'deleted'
    ${statusClause}
  `);
  const total = (countResult as unknown as Array<{ total: number }>)[0]?.total ?? 0;
  const itemsResult = await db.execute(sql`
    WITH RECURSIVE downline AS (
      SELECT r.user_id, 1 AS level
      FROM referral r
      WHERE r.sponsor_id = ${userId}
      UNION ALL
      SELECT r.user_id, d.level + 1 AS level
      FROM referral r
      JOIN downline d ON r.sponsor_id = d.user_id
      WHERE d.level < 7
    )
    SELECT
      usr.id,
      usr.name,
      usr.username,
      usr.email,
      usr.membership_status AS "membershipStatus",
      usr.created_at AS "joinedAt",
      d.level,
      COALESCE(SUM(c.amount_usd_cents), 0)::int AS "totalEarnedUsdCents"
    FROM downline d
    JOIN "user" usr ON usr.id = d.user_id
    LEFT JOIN membership m ON m.user_id = d.user_id
    LEFT JOIN commission c ON c.from_user_id = usr.id AND c.to_user_id = ${userId}
    WHERE usr.membership_status != 'deleted'
    ${statusClause}
    GROUP BY usr.id, usr.name, usr.username, usr.email, usr.membership_status, usr.created_at, d.level
    ORDER BY d.level ASC, usr.created_at DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `);
  const items = (itemsResult as unknown as Array<{
    id: string;
    name: string;
    username: string | null;
    email: string;
    membershipStatus: MembershipStatus;
    joinedAt: Date;
    level: number;
    totalEarnedUsdCents: number;
  }>).map((row) => ({
    id: row.id,
    name: row.name,
    username: row.username,
    email: row.email,
    membershipStatus: row.membershipStatus,
    joinedAt: row.joinedAt instanceof Date ? row.joinedAt.toISOString() : String(row.joinedAt),
    level: row.level,
    totalEarnedUsdCents: row.totalEarnedUsdCents ?? 0,
  }));
  return { items, total, page, pageSize };
}
