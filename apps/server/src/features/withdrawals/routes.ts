import type { FastifyInstance } from "fastify";
import { asyncHandler } from "../../utils/async-handler";
import { auth } from "../auth/auth";
import type { Session } from "../auth/auth";
import { confirmIdentity, IdentityConfirmationError } from "../auth";
import { requirePermissions } from "../auth/permissions";
import { getUserAccessState, requireActiveMembershipOrAdmin } from "../auth/guards";
import { ForbiddenError, UnauthorizedError, ValidationError } from "../../types/errors";
import { WITHDRAWAL_REQUIRES_2FA } from "./config";
import {
  getWalletSummary,
  listWalletTransactions,
  createWithdrawalRequest,
  listUserWithdrawals,
  cancelWithdrawalRequest,
  listAdminWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  markWithdrawalProcessing,
  markWithdrawalPaid,
  markWithdrawalFailed,
  payoutWithdrawal,
  listWalletDestinations,
  createWalletDestination,
  deleteWalletDestination,
  setDefaultWalletDestination,
  type WithdrawalStatus,
} from "./service";

async function getSession(headers: Record<string, string | string[] | undefined>) {
  return auth.api.getSession({ headers: headers as Record<string, string> });
}

async function requireWithdrawPermission(
  session: Session,
  action: "create" | "approve",
  state?: Awaited<ReturnType<typeof getUserAccessState>>
) {
  if (action === "create") {
    const current = state ?? (await getUserAccessState(session.user.id));
    if (current.role === "admin" || current.membershipStatus === "active") {
      return;
    }
  }
  await requirePermissions(session.user.id, {
    withdrawals: [action],
  });
}

export function registerWithdrawalRoutes(app: FastifyInstance) {
  app.get(
    "/api/wallet/summary",
    {
      schema: {
        tags: ["Wallet"],
        summary: "Get wallet summary for the current user",
        response: {
          200: { $ref: "WalletSummary#" },
        },
      },
    },
    asyncHandler(async (request) => {
      const session = (await getSession(request.headers)) as Session;
      if (!session?.user) {
        throw new UnauthorizedError();
      }
      const state = await requireActiveMembershipOrAdmin(session);
      await requireWithdrawPermission(session, "create", state);
      return getWalletSummary(session.user.id);
    })
  );

  app.get(
    "/api/wallet/destinations",
    {
      schema: {
        tags: ["Wallet"],
        summary: "List saved withdrawal destinations for the current user",
        response: {
          200: {
            type: "object",
            required: ["items"],
            properties: {
              items: {
                type: "array",
                items: { $ref: "WalletDestination#" },
              },
            },
          },
        },
      },
    },
    asyncHandler(async (request) => {
      const session = (await getSession(request.headers)) as Session;
      if (!session?.user) {
        throw new UnauthorizedError();
      }
      const state = await requireActiveMembershipOrAdmin(session);
      await requireWithdrawPermission(session, "create", state);
      return listWalletDestinations(session.user.id);
    })
  );

  app.post(
    "/api/wallet/destinations",
    {
      schema: {
        tags: ["Wallet"],
        summary: "Create a saved withdrawal destination",
        body: {
          type: "object",
          required: ["label", "address", "password"],
          properties: {
            label: { type: "string", minLength: 1, maxLength: 80 },
            address: { type: "string", minLength: 6, maxLength: 200 },
            chain: { type: "string", nullable: true },
            isDefault: { type: "boolean" },
            password: { type: "string", minLength: 1 },
            code: { type: "string", minLength: 6, maxLength: 6 },
          },
        },
        response: {
          200: { $ref: "WalletDestination#" },
        },
      },
    },
    asyncHandler(async (request, reply) => {
      const session = (await getSession(request.headers)) as Session;
      if (!session?.user) {
        throw new UnauthorizedError();
      }
      const state = await requireActiveMembershipOrAdmin(session);
      await requireWithdrawPermission(session, "create", state);

      const body = request.body as {
        label: string;
        address: string;
        chain?: string | null;
        isDefault?: boolean;
        password: string;
        code?: string;
      };

      try {
        await confirmIdentity({
          session,
          password: body.password,
          code: body.code,
          headers: request.headers as Record<string, string>,
        });
      } catch (error: unknown) {
        if (error instanceof IdentityConfirmationError) {
          return reply.status(error.statusCode).send({ error: error.message });
        }
        throw error;
      }

      return createWalletDestination({
        userId: session.user.id,
        label: body.label,
        address: body.address,
        chain: body.chain ?? null,
        isDefault: body.isDefault,
      });
    })
  );

  app.delete(
    "/api/wallet/destinations/:id",
    {
      schema: {
        tags: ["Wallet"],
        summary: "Delete a saved withdrawal destination",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        response: {
          200: {
            type: "object",
            required: ["deletedId"],
            properties: {
              deletedId: { type: "string" },
            },
          },
        },
      },
    },
    asyncHandler(async (request) => {
      const session = (await getSession(request.headers)) as Session;
      if (!session?.user) {
        throw new UnauthorizedError();
      }
      const state = await requireActiveMembershipOrAdmin(session);
      await requireWithdrawPermission(session, "create", state);
      const params = request.params as { id: string };
      if (!params.id) {
        throw new ValidationError("Missing destination id.");
      }
      return deleteWalletDestination({
        userId: session.user.id,
        destinationId: params.id,
      });
    })
  );

  app.post(
    "/api/wallet/destinations/:id/default",
    {
      schema: {
        tags: ["Wallet"],
        summary: "Set a saved withdrawal destination as default",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        response: {
          200: { $ref: "WalletDestination#" },
        },
      },
    },
    asyncHandler(async (request) => {
      const session = (await getSession(request.headers)) as Session;
      if (!session?.user) {
        throw new UnauthorizedError();
      }
      const state = await requireActiveMembershipOrAdmin(session);
      await requireWithdrawPermission(session, "create", state);
      const params = request.params as { id: string };
      if (!params.id) {
        throw new ValidationError("Missing destination id.");
      }
      return setDefaultWalletDestination({
        userId: session.user.id,
        destinationId: params.id,
      });
    })
  );

  app.get(
    "/api/wallet/transactions",
    {
      schema: {
        tags: ["Wallet"],
        summary: "List wallet transactions for the current user",
        response: {
          200: {
            type: "object",
            required: ["items"],
            properties: {
              items: {
                type: "array",
                items: { $ref: "WalletTransaction#" },
              },
            },
          },
        },
      },
    },
    asyncHandler(async (request) => {
      const session = (await getSession(request.headers)) as Session;
      if (!session?.user) {
        throw new UnauthorizedError();
      }
      const state = await requireActiveMembershipOrAdmin(session);
      await requireWithdrawPermission(session, "create", state);
      return listWalletTransactions(session.user.id);
    })
  );

  app.get(
    "/api/withdrawals",
    {
      schema: {
        tags: ["Withdrawals"],
        summary: "List withdrawal requests for the current user",
        response: {
          200: {
            type: "object",
            required: ["items"],
            properties: {
              items: {
                type: "array",
                items: { $ref: "WithdrawalRequest#" },
              },
            },
          },
        },
      },
    },
    asyncHandler(async (request) => {
      const session = (await getSession(request.headers)) as Session;
      if (!session?.user) {
        throw new UnauthorizedError();
      }
      const state = await requireActiveMembershipOrAdmin(session);
      await requireWithdrawPermission(session, "create", state);
      return listUserWithdrawals(session.user.id);
    })
  );

  app.post(
    "/api/withdrawals",
    {
      schema: {
        tags: ["Withdrawals"],
        summary: "Create a withdrawal request",
        body: {
          type: "object",
          required: ["amountUsdCents", "destination", "password"],
          properties: {
            amountUsdCents: { type: "number" },
            destination: { type: "string", minLength: 6, maxLength: 200 },
            chain: { type: "string", nullable: true },
            password: { type: "string", minLength: 1 },
            code: { type: "string", minLength: 6, maxLength: 6 },
          },
        },
        response: {
          200: { $ref: "WithdrawalRequest#" },
        },
      },
    },
    asyncHandler(async (request, reply) => {
      const session = (await getSession(request.headers)) as Session;
      if (!session?.user) {
        throw new UnauthorizedError();
      }
      const state = await requireActiveMembershipOrAdmin(session);
      await requireWithdrawPermission(session, "create", state);
      if (WITHDRAWAL_REQUIRES_2FA && !state.twoFactorEnabled) {
        throw new ForbiddenError("Two-factor authentication required.");
      }

      const body = request.body as {
        amountUsdCents: number;
        destination: string;
        chain?: string | null;
        password: string;
        code?: string;
      };

      try {
        await confirmIdentity({
          session,
          password: body.password,
          code: body.code,
          headers: request.headers as Record<string, string>,
        });
      } catch (error: unknown) {
        if (error instanceof IdentityConfirmationError) {
          return reply.status(error.statusCode).send({ error: error.message });
        }
        throw error;
      }

      return createWithdrawalRequest({
        userId: session.user.id,
        amountUsdCents: body.amountUsdCents,
        destination: body.destination,
        chain: body.chain ?? null,
      });
    })
  );

  app.post(
    "/api/withdrawals/:id/cancel",
    {
      schema: {
        tags: ["Withdrawals"],
        summary: "Cancel a pending withdrawal request",
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
        response: {
          200: { $ref: "WithdrawalRequest#" },
        },
      },
    },
    asyncHandler(async (request) => {
      const session = (await getSession(request.headers)) as Session;
      if (!session?.user) {
        throw new UnauthorizedError();
      }
      const state = await requireActiveMembershipOrAdmin(session);
      await requireWithdrawPermission(session, "create", state);

      const params = request.params as { id: string };
      if (!params.id) {
        throw new ValidationError("Missing withdrawal id.");
      }

      return cancelWithdrawalRequest({
        userId: session.user.id,
        withdrawalId: params.id,
      });
    })
  );

  app.get(
    "/api/admin/withdrawals",
    {
      schema: {
        tags: ["Withdrawals"],
        summary: "List withdrawal requests (admin)",
        querystring: {
          type: "object",
          properties: {
            status: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            required: ["items"],
            properties: {
              items: {
                type: "array",
                items: { $ref: "WithdrawalRequest#" },
              },
            },
          },
        },
      },
    },
    asyncHandler(async (request) => {
      const session = (await getSession(request.headers)) as Session;
      if (!session?.user) {
        throw new UnauthorizedError();
      }
      await requireWithdrawPermission(session, "approve");

      const query = request.query as { status?: WithdrawalStatus };
      return listAdminWithdrawals(query.status);
    })
  );

  app.post(
    "/api/admin/withdrawals/:id/approve",
    {
      schema: {
        tags: ["Withdrawals"],
        summary: "Approve a withdrawal request (admin)",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        response: {
          200: { $ref: "WithdrawalRequest#" },
        },
      },
    },
    asyncHandler(async (request) => {
      const session = (await getSession(request.headers)) as Session;
      if (!session?.user) {
        throw new UnauthorizedError();
      }
      await requireWithdrawPermission(session, "approve");
      const params = request.params as { id: string };
      return approveWithdrawal({ withdrawalId: params.id, adminId: session.user.id });
    })
  );

  app.post(
    "/api/admin/withdrawals/:id/reject",
    {
      schema: {
        tags: ["Withdrawals"],
        summary: "Reject a withdrawal request (admin)",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        body: {
          type: "object",
          properties: {
            reason: { type: "string" },
          },
        },
        response: {
          200: { $ref: "WithdrawalRequest#" },
        },
      },
    },
    asyncHandler(async (request) => {
      const session = (await getSession(request.headers)) as Session;
      if (!session?.user) {
        throw new UnauthorizedError();
      }
      await requireWithdrawPermission(session, "approve");
      const params = request.params as { id: string };
      const body = request.body as { reason?: string };
      return rejectWithdrawal({
        withdrawalId: params.id,
        adminId: session.user.id,
        reason: body?.reason,
      });
    })
  );

  app.post(
    "/api/admin/withdrawals/:id/processing",
    {
      schema: {
        tags: ["Withdrawals"],
        summary: "Mark a withdrawal as processing (admin)",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        response: {
          200: { $ref: "WithdrawalRequest#" },
        },
      },
    },
    asyncHandler(async (request) => {
      const session = (await getSession(request.headers)) as Session;
      if (!session?.user) {
        throw new UnauthorizedError();
      }
      await requireWithdrawPermission(session, "approve");
      const params = request.params as { id: string };
      return markWithdrawalProcessing({ withdrawalId: params.id, adminId: session.user.id });
    })
  );

  app.post(
    "/api/admin/withdrawals/:id/paid",
    {
      schema: {
        tags: ["Withdrawals"],
        summary: "Mark a withdrawal as paid (admin)",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        body: {
          type: "object",
          properties: {
            txHash: { type: "string" },
            chain: { type: "string" },
          },
        },
        response: {
          200: { $ref: "WithdrawalRequest#" },
        },
      },
    },
    asyncHandler(async (request) => {
      const session = (await getSession(request.headers)) as Session;
      if (!session?.user) {
        throw new UnauthorizedError();
      }
      await requireWithdrawPermission(session, "approve");
      const params = request.params as { id: string };
      const body = request.body as { txHash?: string; chain?: string };
      return markWithdrawalPaid({
        withdrawalId: params.id,
        adminId: session.user.id,
        txHash: body?.txHash ?? null,
        chain: body?.chain ?? null,
      });
    })
  );

  app.post(
    "/api/admin/withdrawals/:id/failed",
    {
      schema: {
        tags: ["Withdrawals"],
        summary: "Mark a withdrawal as failed (admin)",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        body: {
          type: "object",
          properties: {
            reason: { type: "string" },
          },
        },
        response: {
          200: { $ref: "WithdrawalRequest#" },
        },
      },
    },
    asyncHandler(async (request) => {
      const session = (await getSession(request.headers)) as Session;
      if (!session?.user) {
        throw new UnauthorizedError();
      }
      await requireWithdrawPermission(session, "approve");
      const params = request.params as { id: string };
      const body = request.body as { reason?: string };
      return markWithdrawalFailed({
        withdrawalId: params.id,
        adminId: session.user.id,
        reason: body?.reason ?? null,
      });
    })
  );

  app.post(
    "/api/admin/withdrawals/:id/payout",
    {
      schema: {
        tags: ["Withdrawals"],
        summary: "Trigger a payout via reserve (admin)",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        response: {
          200: { $ref: "WithdrawalRequest#" },
        },
      },
    },
    asyncHandler(async (request) => {
      const session = (await getSession(request.headers)) as Session;
      if (!session?.user) {
        throw new UnauthorizedError();
      }
      await requireWithdrawPermission(session, "approve");
      const params = request.params as { id: string };
      return payoutWithdrawal({
        withdrawalId: params.id,
        adminId: session.user.id,
      });
    })
  );
}
