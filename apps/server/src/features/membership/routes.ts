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
import type { MembershipTier } from "@nexxatrade/core";
import type { Session } from "../auth/auth";
import { NotFoundError } from "../../types/errors";
import { requirePermission } from "../auth/permissions";
import {
  createMembershipPlan,
  listMembershipPlans,
  updateMembershipPlan,
} from "./plans";

const { user, membership } = schema;


async function getSession(headers: Record<string, string | string[] | undefined>) {
  return auth.api.getSession({ headers: headers as Record<string, string> });
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
      tiers: await listMembershipPlans({ includeInactive: true }),
    }))
  );

  app.post(
    "/api/membership/plans",
    {
      schema: {
        tags: ["Membership"],
        summary: "Create a membership plan",
        body: {
          type: "object",
          required: ["tier", "name", "priceUsdCents", "durationDays"],
          properties: {
            tier: { type: "string" },
            name: { type: "string" },
            description: { type: "string", nullable: true },
            priceUsdCents: { type: "number" },
            durationDays: { type: "number", nullable: true },
            isActive: { type: "boolean" },
            sortOrder: { type: "number" },
          },
        },
        response: {
          200: {
            $ref: "MembershipTierInfo#",
          },
        },
      },
    },
    asyncHandler(async (request, reply) => {
      const session = await getSession(request.headers) as Session;
      if (!session?.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      await requirePermission(session.user.id, "membership", "manage");

      const body = request.body as {
        tier: string;
        name: string;
        description?: string | null;
        priceUsdCents: number;
        durationDays: number | null;
        isActive?: boolean;
        sortOrder?: number;
      };

      const plan = await createMembershipPlan({
        tier: body.tier,
        name: body.name,
        description: body.description,
        priceUsdCents: body.priceUsdCents,
        durationDays: body.durationDays,
        isActive: body.isActive,
        sortOrder: body.sortOrder,
      });

      return plan;
    })
  );

  app.patch(
    "/api/membership/plans/:tier",
    {
      schema: {
        tags: ["Membership"],
        summary: "Update a membership plan",
        params: {
          type: "object",
          required: ["tier"],
          properties: {
            tier: { type: "string" },
          },
        },
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string", nullable: true },
            priceUsdCents: { type: "number" },
            durationDays: { type: "number", nullable: true },
            isActive: { type: "boolean" },
            sortOrder: { type: "number" },
          },
        },
        response: {
          200: {
            $ref: "MembershipTierInfo#",
          },
        },
      },
    },
    asyncHandler(async (request, reply) => {
      const session = await getSession(request.headers) as Session;
      if (!session?.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      await requirePermission(session.user.id, "membership", "manage");

      const params = request.params as { tier: string };
      const body = request.body as {
        name?: string;
        description?: string | null;
        priceUsdCents?: number;
        durationDays?: number | null;
        isActive?: boolean;
        sortOrder?: number;
      };

      const plan = await updateMembershipPlan(params.tier, body);
      return plan;
    })
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
        await requirePermission(session.user.id, "membership", "manage");
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
      await requirePermission(session.user.id, "membership", "manage");

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

      const tier: MembershipTier = body.tier;

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
      await requirePermission(session.user.id, "membership", "manage");
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
      await requirePermission(session.user.id, "membership", "manage");
      return compressInactiveUsers();
    })
  );
}
