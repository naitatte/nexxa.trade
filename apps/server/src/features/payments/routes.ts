import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { asyncHandler } from "../../utils/async-handler";
import { auth, type Session } from "../auth/auth";
import type { MembershipTier } from "@nexxatrade/core";
import { createPaymentIntent, getPaymentStatus, listUserPayments } from "./service";

async function getSession(headers: Record<string, string | string[] | undefined>): Promise<Session | null> {
  const session: Session = (await auth.api.getSession({ headers: headers as Record<string, string> })) as Session;
  return session ?? null;
}

export function registerPaymentRoutes(app: FastifyInstance): void {
  app.get(
    "/api/payments/invoices",
    {
      schema: {
        tags: ["Payments"],
        summary: "List membership payment invoices for the current user",
        querystring: {
          type: "object",
          properties: {
            page: { type: "number" },
            pageSize: { type: "number" },
          },
        },
        response: {
          200: {
            type: "object",
            required: ["page", "pageSize", "total", "items"],
            properties: {
              page: { type: "number" },
              pageSize: { type: "number" },
              total: { type: "number" },
              items: {
                type: "array",
                items: {
                  type: "object",
                  required: ["id", "tier", "status", "amountUsdCents", "createdAt"],
                  properties: {
                    id: { type: "string" },
                    tier: { type: "string" },
                    status: { type: "string" },
                    sweepStatus: { type: "string", nullable: true },
                    amountUsdCents: { type: "number" },
                    chain: { type: "string", nullable: true },
                    txHash: { type: "string", nullable: true },
                    depositAddress: { type: "string", nullable: true },
                    createdAt: { type: "string", format: "date-time" },
                    confirmedAt: { type: "string", format: "date-time", nullable: true },
                    appliedAt: { type: "string", format: "date-time", nullable: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply): Promise<unknown> => {
      const session: Session | null = await getSession(request.headers);
      if (!session?.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const query = request.query as { page?: number | string; pageSize?: number | string };
      const page = query.page !== undefined ? Number(query.page) : undefined;
      const pageSize = query.pageSize !== undefined ? Number(query.pageSize) : undefined;
      return listUserPayments({
        userId: session.user.id,
        page,
        pageSize,
      });
    })
  );
  app.post(
    "/api/payments/address",
    {
      schema: {
        tags: ["Payments"],
        summary: "Create a payment intent and reserve a deposit address",
        body: {
          type: "object",
          required: ["tier"],
          properties: {
            tier: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            required: ["paymentId", "depositAddress", "amountUsdCents", "chain"],
            properties: {
              paymentId: { type: "string" },
              depositAddress: { type: "string" },
              amountUsdCents: { type: "number" },
              chain: { type: "string" },
            },
          },
        },
      },
    },
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply): Promise<unknown> => {
      const session: Session | null = await getSession(request.headers);
      if (!session?.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const body: { tier: string } = request.body as { tier: string };
      const tier: MembershipTier = body.tier;
      const result: Awaited<ReturnType<typeof createPaymentIntent>> = await createPaymentIntent({ userId: session.user.id, tier });
      return result;
    })
  );
  app.get(
    "/api/payments/:paymentId",
    {
      schema: {
        tags: ["Payments"],
        summary: "Get payment status",
        params: {
          type: "object",
          required: ["paymentId"],
          properties: {
            paymentId: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            required: ["paymentId", "status", "amountUsdCents"],
            properties: {
              paymentId: { type: "string" },
              status: { type: "string" },
              sweepStatus: { type: "string", nullable: true },
              depositAddress: { type: "string", nullable: true },
              amountUsdCents: { type: "number" },
              chain: { type: "string", nullable: true },
              txHash: { type: "string", nullable: true },
              confirmedAt: { type: "string", format: "date-time", nullable: true },
              sweptAt: { type: "string", format: "date-time", nullable: true },
              appliedAt: { type: "string", format: "date-time", nullable: true },
            },
          },
        },
      },
    },
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply): Promise<unknown> => {
      const session: Session | null = await getSession(request.headers);
      if (!session?.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const params: { paymentId: string } = request.params as { paymentId: string };
      const payment: Awaited<ReturnType<typeof getPaymentStatus>> = await getPaymentStatus({ paymentId: params.paymentId, userId: session.user.id });
      if (!payment) {
        return reply.status(404).send({ error: "Not found" });
      }
      return payment;
    })
  );
}
