import type { FastifyInstance } from "fastify";
import { asyncHandler } from "../../utils/async-handler";
import { db } from "../../config/db";
import { schema, eq } from "@nexxatrade/db";
import { auth } from "../auth/auth";
import {
  activateMembership,
  compressInactiveUsers,
  expireMemberships,
} from "./service";
import { MEMBERSHIP_DELETION_DAYS } from "./config";
import {
  MEMBERSHIP_TIER_LIST,
  MEMBERSHIP_TIERS,
  type MembershipTier,
} from "@nexxatrade/core";
import type { Session } from "../auth/auth";
import { NotFoundError, ValidationError } from "../../types/errors";

const { user, membership } = schema;

const tierList = [...MEMBERSHIP_TIER_LIST] as MembershipTier[];

function parseTier(tier: string): MembershipTier {
  if (tierList.includes(tier as MembershipTier)) {
    return tier as MembershipTier;
  }
  throw new ValidationError("Invalid membership tier");
}

async function getSession(headers: Record<string, string | string[] | undefined>) {
  return auth.api.getSession({ headers: headers as Record<string, string> });
}

type PermissionInput = Record<string, string[]>;

async function hasPermissions(userId: string, permissions: PermissionInput): Promise<boolean> {
  const result: unknown = await auth.api.userHasPermission({
    body: {
      userId,
      permissions,
    },
  });

  if (typeof result === "boolean") {
    return result;
  }

  if (result && typeof result === "object") {
    if ("success" in result) {
      return (result as { success?: boolean }).success === true;
    }
    if ("data" in result) {
      return (result as { data?: boolean }).data === true;
    }
  }

  return false;
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
    asyncHandler(async (request, reply) => {
      const session = await getSession(request.headers) as Session;
      if (!session?.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { userId } = request.params as { userId: string };
      if (session.user.id !== userId) {
        const allowed = await hasPermissions(session.user.id, {
          membership: ["manage"],
        });
        if (!allowed) {
          return reply.status(403).send({ error: "Forbidden" });
        }
      }

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
      const deletionAt = inactiveAt
        ? new Date(
            new Date(inactiveAt).getTime() +
              MEMBERSHIP_DELETION_DAYS * 24 * 60 * 60 * 1000
          ).toISOString()
        : undefined;

      return {
        userId: userRecord[0].id,
        status: userRecord[0].status,
        ...(userRecord[0].tier ? { tier: userRecord[0].tier } : {}),
        ...(expiresAt ? { expiresAt } : {}),
        ...(inactiveAt ? { inactiveAt } : {}),
        ...(deletionAt ? { deletionAt } : {}),
        ...(activatedAt ? { activatedAt } : {}),
        deletionDays: MEMBERSHIP_DELETION_DAYS,
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
    asyncHandler(async (request, reply) => {
      const session = await getSession(request.headers) as Session;
      if (!session?.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const allowed = await hasPermissions(session.user.id, {
        membership: ["manage"],
      });
      if (!allowed) {
        return reply.status(403).send({ error: "Forbidden" });
      }

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
    asyncHandler(async (request, reply) => {
      const session = await getSession(request.headers) as Session;
      if (!session?.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const allowed = await hasPermissions(session.user.id, {
        membership: ["manage"],
      });
      if (!allowed) {
        return reply.status(403).send({ error: "Forbidden" });
      }
      return expireMemberships();
    })
  );

  app.post(
    "/api/membership/compress",
    {
      schema: {
        tags: ["Membership"],
        summary: "Compress inactive users and mark accounts deleted",
        response: {
          200: {
            $ref: "CompressMembershipsResponse#",
          },
        },
      },
    },
    asyncHandler(async (request, reply) => {
      const session = await getSession(request.headers) as Session;
      if (!session?.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const allowed = await hasPermissions(session.user.id, {
        membership: ["manage"],
      });
      if (!allowed) {
        return reply.status(403).send({ error: "Forbidden" });
      }
      return compressInactiveUsers();
    })
  );
}
