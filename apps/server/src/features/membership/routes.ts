import type { FastifyInstance } from "fastify";
import { asyncHandler } from "../../utils/async-handler";
import { db } from "../../config/db";
import { schema, eq } from "@nexxatrade/db";
import {
  activateMembership,
  compressInactiveUsers,
  expireMemberships,
} from "./service";
import {
  MEMBERSHIP_TIER_LIST,
  MEMBERSHIP_TIERS,
  type MembershipTier,
} from "@nexxatrade/core";
import { NotFoundError, ValidationError } from "../../types/errors";

const { user, membership } = schema;

const tierList = [...MEMBERSHIP_TIER_LIST] as MembershipTier[];

function parseTier(tier: string): MembershipTier {
  if (tierList.includes(tier as MembershipTier)) {
    return tier as MembershipTier;
  }
  throw new ValidationError("Invalid membership tier");
}

export function registerMembershipRoutes(app: FastifyInstance) {
  app.get(
    "/api/membership/tiers",
    {
      schema: {
        tags: ["Membership"],
        summary: "List membership tiers",
        response: {
          200: {
            $ref: "MembershipTierList#",
          },
        },
      },
    },
    asyncHandler(async () => ({
      tiers: tierList.map((tier) => {
        const durationDays = MEMBERSHIP_TIERS[tier].durationDays;
        return {
          tier,
          priceUsdCents: MEMBERSHIP_TIERS[tier].priceUsdCents,
          ...(durationDays !== null ? { durationDays } : {}),
        };
      }),
    }))
  );

  app.get(
    "/api/membership/users/:userId",
    {
      schema: {
        tags: ["Membership"],
        summary: "Get membership state for a user",
        params: {
          type: "object",
          required: ["userId"],
          properties: {
            userId: { type: "string" },
          },
        },
        response: {
          200: {
            $ref: "MembershipState#",
          },
        },
      },
    },
    asyncHandler(async (request) => {
      const { userId } = request.params as { userId: string };
      const userRecord = await db
        .select({
          id: user.id,
          status: user.membershipStatus,
          tier: user.membershipTier,
          expiresAt: user.membershipExpiresAt,
        })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      if (!userRecord.length) {
        throw new NotFoundError("User", userId);
      }

      const membershipRecord = await db
        .select({
          inactiveAt: membership.inactiveAt,
          activatedAt: membership.activatedAt,
        })
        .from(membership)
        .where(eq(membership.userId, userId))
        .limit(1);

      const expiresAt = userRecord[0].expiresAt?.toISOString();
      const inactiveAt = membershipRecord[0]?.inactiveAt?.toISOString();
      const activatedAt = membershipRecord[0]?.activatedAt?.toISOString();

      return {
        userId: userRecord[0].id,
        status: userRecord[0].status,
        ...(userRecord[0].tier ? { tier: userRecord[0].tier } : {}),
        ...(expiresAt ? { expiresAt } : {}),
        ...(inactiveAt ? { inactiveAt } : {}),
        ...(activatedAt ? { activatedAt } : {}),
      };
    })
  );

  app.post(
    "/api/membership/activate",
    {
      schema: {
        tags: ["Membership"],
        summary: "Activate a membership after payment confirmation",
        body: {
          $ref: "ActivateMembershipRequest#",
        },
        response: {
          200: {
            $ref: "ActivateMembershipResponse#",
          },
        },
      },
    },
    asyncHandler(async (request) => {
      const body = request.body as {
        userId: string;
        tier: string;
        amountUsdCents: number;
        paymentId?: string;
        txHash?: string;
        chain?: string;
        fromAddress?: string;
        toAddress?: string;
        reason?: string;
      };

      const tier = parseTier(body.tier);

      const result = await activateMembership({
        userId: body.userId,
        tier,
        amountUsdCents: body.amountUsdCents,
        paymentId: body.paymentId,
        txHash: body.txHash,
        chain: body.chain,
        fromAddress: body.fromAddress,
        toAddress: body.toAddress,
        reason: body.reason,
      });

      const expiresAt = result.expiresAt?.toISOString();

      return {
        paymentId: result.paymentId,
        status: result.status,
        commissionsCreated: result.commissionsCreated,
        ...(expiresAt ? { expiresAt } : {}),
      };
    })
  );

  app.post(
    "/api/membership/expire",
    {
      schema: {
        tags: ["Membership"],
        summary: "Expire memberships that are past due",
        response: {
          200: {
            $ref: "ExpireMembershipsResponse#",
          },
        },
      },
    },
    asyncHandler(async () => expireMemberships())
  );

  app.post(
    "/api/membership/compress",
    {
      schema: {
        tags: ["Membership"],
        summary: "Compress inactive users and delete accounts",
        response: {
          200: {
            $ref: "CompressMembershipsResponse#",
          },
        },
      },
    },
    asyncHandler(async () => compressInactiveUsers())
  );
}
