import crypto from "node:crypto";
import { db } from "../../config/db";
import { schema, sql, and, eq, inArray, isNotNull, lte, lt } from "@nexxatrade/db";
import {
  calculateCommissionSplit,
  calculateExpiresAt,
  COMMISSION_RULES,
  type MembershipTier,
  type MembershipStatus,
} from "@nexxatrade/core";
import { NotFoundError } from "../../types/errors";

const {
  user,
  membership,
  membershipEvent,
  membershipPayment,
  commission,
  referral,
} = schema;

type ActivateMembershipInput = {
  userId: string;
  tier: MembershipTier;
  amountUsdCents: number;
  paymentId?: string;
  txHash?: string;
  chain?: string;
  fromAddress?: string;
  toAddress?: string;
  reason?: string;
};

type MembershipEventInput = {
  userId: string;
  fromStatus?: MembershipStatus | null;
  toStatus: MembershipStatus;
  reason?: string | null;
};

type UplineRow = {
  sponsorId: string;
  level: number;
};

const DEFAULT_EVENT_REASON = "payment_confirmed";

type Database = typeof db;

async function recordMembershipEvent(
  tx: Database | Parameters<Parameters<typeof db.transaction>[0]>[0],
  event: MembershipEventInput
) {
  await tx.insert(membershipEvent).values({
    id: crypto.randomUUID(),
    userId: event.userId,
    fromStatus: event.fromStatus ?? null,
    toStatus: event.toStatus,
    reason: event.reason ?? null,
  });
}

async function getUpline(
  tx: Database | Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
  maxLevels: number
): Promise<UplineRow[]> {
  const result = await tx.execute(sql`
    WITH RECURSIVE uplines AS (
      SELECT sponsor_id AS "sponsorId", 1 AS level
      FROM referral
      WHERE user_id = ${userId}
      UNION ALL
      SELECT r.sponsor_id AS "sponsorId", u.level + 1 AS level
      FROM referral r
      JOIN uplines u ON r.user_id = u."sponsorId"
      WHERE u.level < ${maxLevels}
    )
    SELECT "sponsorId", level
    FROM uplines
    WHERE "sponsorId" IS NOT NULL
    ORDER BY level;
  `);

  return (result as unknown as UplineRow[]) ?? [];
}

export async function activateMembership(input: ActivateMembershipInput) {
  const now = new Date();
  const paymentId = input.paymentId ?? crypto.randomUUID();
  const reason = input.reason ?? DEFAULT_EVENT_REASON;

  return db.transaction(async (tx) => {
    const existingUser = await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, input.userId))
      .limit(1);

    if (!existingUser.length) {
      throw new NotFoundError("User", input.userId);
    }

    const existingMembership = await tx
      .select()
      .from(membership)
      .where(eq(membership.userId, input.userId))
      .limit(1);

    const previousStatus =
      existingMembership[0]?.status ?? ("inactive" as MembershipStatus);

    const baseDate =
      existingMembership[0]?.status === "active" &&
      existingMembership[0]?.expiresAt
        ? existingMembership[0]?.expiresAt
        : now;

    const expiresAt = calculateExpiresAt(input.tier, baseDate);

    if (existingMembership.length) {
      await tx
        .update(membership)
        .set({
          tier: input.tier,
          status: "active",
          activatedAt: now,
          expiresAt,
          inactiveAt: null,
          updatedAt: now,
        })
        .where(eq(membership.userId, input.userId));
    } else {
      await tx.insert(membership).values({
        userId: input.userId,
        tier: input.tier,
        status: "active",
        startsAt: now,
        activatedAt: now,
        expiresAt,
        inactiveAt: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    await tx
      .update(user)
      .set({
        membershipStatus: "active",
        membershipTier: input.tier,
        membershipExpiresAt: expiresAt,
        updatedAt: now,
      })
      .where(eq(user.id, input.userId));

    await recordMembershipEvent(tx, {
      userId: input.userId,
      fromStatus: previousStatus,
      toStatus: "active",
      reason,
    });

    const existingPayment = await tx
      .select({ id: membershipPayment.id, status: membershipPayment.status })
      .from(membershipPayment)
      .where(eq(membershipPayment.id, paymentId))
      .limit(1);

    if (!existingPayment.length) {
      await tx.insert(membershipPayment).values({
        id: paymentId,
        userId: input.userId,
        tier: input.tier,
        status: "confirmed",
        amountUsdCents: input.amountUsdCents,
        chain: input.chain ?? null,
        txHash: input.txHash ?? null,
        fromAddress: input.fromAddress ?? null,
        toAddress: input.toAddress ?? null,
        createdAt: now,
        confirmedAt: now,
      });
    } else if (existingPayment[0].status !== "confirmed") {
      await tx
        .update(membershipPayment)
        .set({
          status: "confirmed",
          confirmedAt: now,
        })
        .where(eq(membershipPayment.id, paymentId));
    }

    const existingCommission = await tx
      .select({ id: commission.id })
      .from(commission)
      .where(eq(commission.paymentId, paymentId))
      .limit(1);

    let commissionsCreated = 0;

    if (!existingCommission.length) {
      const upline = await getUpline(
        tx,
        input.userId,
        COMMISSION_RULES.maxUplineLevels + 1
      );
      const { sponsorAmountCents, levelAmountCents } = calculateCommissionSplit(
        input.amountUsdCents
      );

      const commissionEntries: Array<typeof commission.$inferInsert> = [];

      const sponsor = upline.find(
        (row) => row.level === COMMISSION_RULES.sponsorLevel
      );
      if (sponsor) {
        commissionEntries.push({
          id: crypto.randomUUID(),
          paymentId,
          fromUserId: input.userId,
          toUserId: sponsor.sponsorId,
          level: COMMISSION_RULES.sponsorLevel,
          amountUsdCents: sponsorAmountCents,
          createdAt: now,
        });
      }

      for (const row of upline) {
        if (row.level <= COMMISSION_RULES.sponsorLevel) {
          continue;
        }
        if (row.level > COMMISSION_RULES.maxUplineLevels + 1) {
          continue;
        }
        commissionEntries.push({
          id: crypto.randomUUID(),
          paymentId,
          fromUserId: input.userId,
          toUserId: row.sponsorId,
          level: row.level,
          amountUsdCents: levelAmountCents,
          createdAt: now,
        });
      }

      if (commissionEntries.length) {
        await tx.insert(commission).values(commissionEntries);
        commissionsCreated = commissionEntries.length;
      }
    }

    return {
      paymentId,
      expiresAt,
      status: "active" as const,
      commissionsCreated,
    };
  });
}

export async function expireMemberships() {
  const now = new Date();

  return db.transaction(async (tx) => {
    const expiring = await tx
      .select({
        userId: membership.userId,
        status: membership.status,
      })
      .from(membership)
      .where(
        and(
          eq(membership.status, "active"),
          isNotNull(membership.expiresAt),
          lt(membership.expiresAt, now)
        )
      );

    if (!expiring.length) {
      return { expiredCount: 0 };
    }

    const userIds = expiring.map((row) => row.userId);

    await tx
      .update(membership)
      .set({
        status: "inactive",
        inactiveAt: now,
        updatedAt: now,
      })
      .where(inArray(membership.userId, userIds));

    await tx
      .update(user)
      .set({
        membershipStatus: "inactive",
        updatedAt: now,
      })
      .where(inArray(user.id, userIds));

    await tx.insert(membershipEvent).values(
      expiring.map((row) => ({
        id: crypto.randomUUID(),
        userId: row.userId,
        fromStatus: row.status,
        toStatus: "inactive" as const,
        reason: "expired",
        createdAt: now,
      }))
    );

    return { expiredCount: userIds.length };
  });
}

export async function compressInactiveUsers() {
  const now = new Date();
  const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  return db.transaction(async (tx) => {
    const candidates = await tx
      .select({
        userId: membership.userId,
      })
      .from(membership)
      .where(
        and(
          eq(membership.status, "inactive"),
          isNotNull(membership.inactiveAt),
          lte(membership.inactiveAt, cutoff)
        )
      );

    if (!candidates.length) {
      return { compressedCount: 0 };
    }

    for (const candidate of candidates) {
      const sponsor = await tx
        .select({ sponsorId: referral.sponsorId })
        .from(referral)
        .where(eq(referral.userId, candidate.userId))
        .limit(1);

      const sponsorId = sponsor[0]?.sponsorId ?? null;

      await tx
        .update(referral)
        .set({ sponsorId, updatedAt: now })
        .where(eq(referral.sponsorId, candidate.userId));

      await recordMembershipEvent(tx, {
        userId: candidate.userId,
        fromStatus: "inactive",
        toStatus: "deleted",
        reason: "compressed",
      });

      await tx
        .update(membership)
        .set({
          status: "deleted",
          updatedAt: now,
        })
        .where(eq(membership.userId, candidate.userId));

      await tx
        .update(user)
        .set({
          membershipStatus: "deleted",
          updatedAt: now,
        })
        .where(eq(user.id, candidate.userId));

      await tx.delete(user).where(eq(user.id, candidate.userId));
    }

    return { compressedCount: candidates.length };
  });
}
