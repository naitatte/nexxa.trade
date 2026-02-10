import type { FastifyInstance } from "fastify";
import { asyncHandler } from "../../utils/async-handler";
import { auth } from "../auth/auth";
import type { Session } from "../auth/auth";
import { requireActiveMembershipOrAdmin } from "../auth/guards";
import { getReferralStats, getReferralTeam } from "./service";

async function getSession(headers: Record<string, string | string[] | undefined>): Promise<Session | null> {
  return auth.api.getSession({ headers: headers as Record<string, string> });
}

export function registerReferralRoutes(app: FastifyInstance): void {
  app.get(
    "/api/referrals/stats",
    {
      schema: {
        tags: ["Referrals"],
        summary: "Get referral stats for the current user",
        response: {
          200: {
            type: "object",
            required: ["directPartners", "totalTeam", "activeMembers", "atRiskMembers"],
            properties: {
              directPartners: { type: "number" },
              totalTeam: { type: "number" },
              activeMembers: { type: "number" },
              atRiskMembers: { type: "number" },
            },
          },
        },
      },
    },
    asyncHandler(async (request, reply) => {
      const session: Session | null = await getSession(request.headers);
      if (!session?.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      await requireActiveMembershipOrAdmin(session);
      return getReferralStats(session.user.id);
    })
  );

  app.get(
    "/api/referrals/team",
    {
      schema: {
        tags: ["Referrals"],
        summary: "List referral team members with pagination",
        querystring: {
          type: "object",
          properties: {
            page: { type: "number", minimum: 1 },
            pageSize: { type: "number", minimum: 1, maximum: 100 },
            status: { type: "string", enum: ["all", "at_risk"] },
          },
        },
        response: {
          200: {
            type: "object",
            required: ["items", "total", "page", "pageSize"],
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  required: ["id", "name", "email", "membershipStatus", "joinedAt", "level"],
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    username: { type: "string", nullable: true },
                    email: { type: "string" },
                    membershipStatus: { type: "string" },
                    joinedAt: { type: "string" },
                    level: { type: "number" },
                    totalEarnedUsdCents: { type: "number" },
                  },
                },
              },
              total: { type: "number" },
              page: { type: "number" },
              pageSize: { type: "number" },
            },
          },
        },
      },
    },
    asyncHandler(async (request, reply) => {
      const session: Session | null = await getSession(request.headers);
      if (!session?.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      await requireActiveMembershipOrAdmin(session);
      const query = request.query as { page?: number | string; pageSize?: number | string; status?: string };
      const page = query.page !== undefined ? Number(query.page) : undefined;
      const pageSize = query.pageSize !== undefined ? Number(query.pageSize) : undefined;
      const statusFilter = query.status === "at_risk" ? "at_risk" : undefined;
      return getReferralTeam({
        userId: session.user.id,
        page,
        pageSize,
        statusFilter,
      });
    })
  );
}
