import crypto from "node:crypto";
import { db } from "../../config/db";
import { schema, sql, eq, and, desc, inArray } from "@nexxatrade/db";
import { ValidationError, NotFoundError, ConflictError } from "../../types/errors";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import {
  WITHDRAWAL_MIN_USD_CENTS,
  WITHDRAWAL_MAX_USD_CENTS,
  WITHDRAWAL_DAILY_LIMIT_USD_CENTS,
  WITHDRAWAL_CURRENCY,
} from "./config";

const {
  walletAccount,
  walletLedger,
  walletDestination,
  withdrawalRequest,
  withdrawalEvent,
} = schema;

export type WalletSummary = {
  currency: string;
  availableUsdCents: number;
  reservedUsdCents: number;
  lifetimeEarnedUsdCents: number;
  pendingUsdCents: number;
};

export type WalletTransaction = {
  id: string;
  type: "deposit" | "withdrawal";
  amountUsdCents: number;
  status: string;
  chain: string | null;
  txHash: string | null;
  address: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type WalletDestination = {
  id: string;
  label: string;
  address: string;
  chain: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type WithdrawalStatus =
  | "pending_admin"
  | "approved"
  | "processing"
  | "paid"
  | "rejected"
  | "canceled"
  | "failed";

export type WithdrawalRequestResult = {
  id: string;
  userId: string;
  amountUsdCents: number;
  currency: string;
  status: WithdrawalStatus;
  destination: string;
  chain: string | null;
  txHash: string | null;
  adminId: string | null;
  reason: string | null;
  createdAt: string;
  approvedAt: string | null;
  processedAt: string | null;
  paidAt: string | null;
  rejectedAt: string | null;
  canceledAt: string | null;
  failedAt: string | null;
};

const ACTIVE_WITHDRAWAL_STATUSES: WithdrawalStatus[] = [
  "pending_admin",
  "approved",
  "processing",
  "paid",
];

const asIso = (value: Date | null): string | null => (value ? value.toISOString() : null);
const USDT_UNITS_PER_USD_CENT = 10000n;
const PAYOUT_REQUEST_TIMEOUT_MS = 60000;

async function ensureWalletAccount(userId: string): Promise<void> {
  await db
    .insert(walletAccount)
    .values({ userId, currency: WITHDRAWAL_CURRENCY })
    .onConflictDoNothing();
}

async function ensureWalletAccountTx(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string
): Promise<void> {
  await tx
    .insert(walletAccount)
    .values({ userId, currency: WITHDRAWAL_CURRENCY })
    .onConflictDoNothing();
}

function validateAmount(amountUsdCents: number) {
  if (!Number.isFinite(amountUsdCents) || amountUsdCents <= 0) {
    throw new ValidationError("Withdrawal amount must be greater than zero.");
  }
  if (WITHDRAWAL_MIN_USD_CENTS > 0 && amountUsdCents < WITHDRAWAL_MIN_USD_CENTS) {
    throw new ValidationError(
      `Minimum withdrawal amount is $${(WITHDRAWAL_MIN_USD_CENTS / 100).toFixed(2)}.`
    );
  }
  if (WITHDRAWAL_MAX_USD_CENTS > 0 && amountUsdCents > WITHDRAWAL_MAX_USD_CENTS) {
    throw new ValidationError(
      `Maximum withdrawal amount is $${(WITHDRAWAL_MAX_USD_CENTS / 100).toFixed(2)}.`
    );
  }
}

async function getDailyWithdrawalTotal(userId: string, now: Date): Promise<number> {
  if (WITHDRAWAL_DAILY_LIMIT_USD_CENTS <= 0) {
    return 0;
  }
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  const rows = await db
    .select({
      total: sql<number>`COALESCE(SUM(${withdrawalRequest.amountUsdCents}), 0)::int`,
    })
    .from(withdrawalRequest)
    .where(
      and(
        eq(withdrawalRequest.userId, userId),
        sql`${withdrawalRequest.createdAt} >= ${start}`,
        sql`${withdrawalRequest.createdAt} < ${end}`,
        inArray(withdrawalRequest.status, ACTIVE_WITHDRAWAL_STATUSES)
      )
    );

  return rows?.[0]?.total ?? 0;
}

export async function getWalletSummary(userId: string): Promise<WalletSummary> {
  await ensureWalletAccount(userId);
  const accountRows = await db
    .select()
    .from(walletAccount)
    .where(eq(walletAccount.userId, userId))
    .limit(1);

  const account = accountRows[0];
  if (!account) {
    return {
      currency: WITHDRAWAL_CURRENCY,
      availableUsdCents: 0,
      reservedUsdCents: 0,
      lifetimeEarnedUsdCents: 0,
      pendingUsdCents: 0,
    };
  }

  const pendingRows = await db
    .select({
      total: sql<number>`COALESCE(SUM(${withdrawalRequest.amountUsdCents}), 0)::int`,
    })
    .from(withdrawalRequest)
    .where(
      and(
        eq(withdrawalRequest.userId, userId),
        inArray(withdrawalRequest.status, ["pending_admin", "approved", "processing"])
      )
    );

  const pendingUsdCents = pendingRows?.[0]?.total ?? 0;

  return {
    currency: account.currency,
    availableUsdCents: account.availableUsdCents,
    reservedUsdCents: account.reservedUsdCents,
    lifetimeEarnedUsdCents: account.lifetimeEarnedUsdCents,
    pendingUsdCents,
  };
}

export async function listWalletTransactions(userId: string, limit = 200): Promise<{ items: WalletTransaction[] }> {
  await ensureWalletAccount(userId);

  const ledgerRows = await db
    .select({
      id: walletLedger.id,
      amountUsdCents: walletLedger.amountUsdCents,
      createdAt: walletLedger.createdAt,
    })
    .from(walletLedger)
    .where(and(eq(walletLedger.userId, userId), eq(walletLedger.type, "credit")))
    .orderBy(desc(walletLedger.createdAt))
    .limit(limit);

  const withdrawalRows = await db
    .select()
    .from(withdrawalRequest)
    .where(eq(withdrawalRequest.userId, userId))
    .orderBy(desc(withdrawalRequest.createdAt))
    .limit(limit);

  const transactions: WalletTransaction[] = [
    ...ledgerRows.map((row) => ({
      id: row.id,
      type: "deposit" as const,
      amountUsdCents: row.amountUsdCents,
      status: "confirmed",
      chain: null,
      txHash: null,
      address: null,
      createdAt: row.createdAt.toISOString(),
      completedAt: row.createdAt.toISOString(),
    })),
    ...withdrawalRows.map((row) => ({
      id: row.id,
      type: "withdrawal" as const,
      amountUsdCents: row.amountUsdCents,
      status: row.status,
      chain: row.chain ?? null,
      txHash: row.txHash ?? null,
      address: row.destination,
      createdAt: row.createdAt.toISOString(),
      completedAt:
        row.paidAt?.toISOString() ??
        row.rejectedAt?.toISOString() ??
        row.canceledAt?.toISOString() ??
        row.failedAt?.toISOString() ??
        null,
    })),
  ];

  transactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return { items: transactions.slice(0, limit) };
}

export async function createWithdrawalRequest(input: {
  userId: string;
  amountUsdCents: number;
  destination: string;
  chain?: string | null;
}): Promise<WithdrawalRequestResult> {
  const now = new Date();
  const amountUsdCents = Math.floor(input.amountUsdCents);
  validateAmount(amountUsdCents);

  if (!input.destination || input.destination.trim().length < 6) {
    throw new ValidationError("Destination is required.");
  }

  if (WITHDRAWAL_DAILY_LIMIT_USD_CENTS > 0) {
    const dailyTotal = await getDailyWithdrawalTotal(input.userId, now);
    if (dailyTotal + amountUsdCents > WITHDRAWAL_DAILY_LIMIT_USD_CENTS) {
      throw new ValidationError("Daily withdrawal limit reached.");
    }
  }

  return db.transaction(async (tx) => {
    await ensureWalletAccountTx(tx, input.userId);

    const accountRows = await tx
      .select()
      .from(walletAccount)
      .where(eq(walletAccount.userId, input.userId))
      .limit(1);

    const account = accountRows[0];
    if (!account || account.availableUsdCents < amountUsdCents) {
      throw new ValidationError("Insufficient available balance.");
    }

    const withdrawalId = crypto.randomUUID();

    await tx
      .update(walletAccount)
      .set({
        availableUsdCents: sql`${walletAccount.availableUsdCents} - ${amountUsdCents}`,
        reservedUsdCents: sql`${walletAccount.reservedUsdCents} + ${amountUsdCents}`,
        updatedAt: now,
      })
      .where(eq(walletAccount.userId, input.userId));

    await tx.insert(withdrawalRequest).values({
      id: withdrawalId,
      userId: input.userId,
      amountUsdCents,
      currency: WITHDRAWAL_CURRENCY,
      status: "pending_admin",
      destination: input.destination.trim(),
      chain: input.chain ?? null,
      createdAt: now,
    });

    await tx.insert(walletLedger).values({
      id: crypto.randomUUID(),
      userId: input.userId,
      type: "reserve",
      amountUsdCents,
      currency: WITHDRAWAL_CURRENCY,
      referenceType: "withdrawal",
      referenceId: withdrawalId,
      createdAt: now,
    });

    await tx.insert(withdrawalEvent).values({
      id: crypto.randomUUID(),
      withdrawalId,
      fromStatus: null,
      toStatus: "pending_admin",
      actorId: input.userId,
      createdAt: now,
    });

    return {
      id: withdrawalId,
      userId: input.userId,
      amountUsdCents,
      currency: WITHDRAWAL_CURRENCY,
      status: "pending_admin",
      destination: input.destination.trim(),
      chain: input.chain ?? null,
      txHash: null,
      adminId: null,
      reason: null,
      createdAt: now.toISOString(),
      approvedAt: null,
      processedAt: null,
      paidAt: null,
      rejectedAt: null,
      canceledAt: null,
      failedAt: null,
    };
  });
}

export async function listUserWithdrawals(userId: string): Promise<{ items: WithdrawalRequestResult[] }> {
  const rows = await db
    .select()
    .from(withdrawalRequest)
    .where(eq(withdrawalRequest.userId, userId))
    .orderBy(desc(withdrawalRequest.createdAt));

  return {
    items: rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      amountUsdCents: row.amountUsdCents,
      currency: row.currency,
      status: row.status,
      destination: row.destination,
      chain: row.chain ?? null,
      txHash: row.txHash ?? null,
      adminId: row.adminId ?? null,
      reason: row.reason ?? null,
      createdAt: row.createdAt.toISOString(),
      approvedAt: asIso(row.approvedAt),
      processedAt: asIso(row.processedAt),
      paidAt: asIso(row.paidAt),
      rejectedAt: asIso(row.rejectedAt),
      canceledAt: asIso(row.canceledAt),
      failedAt: asIso(row.failedAt),
    })),
  };
}

export async function cancelWithdrawalRequest(input: {
  userId: string;
  withdrawalId: string;
}): Promise<WithdrawalRequestResult> {
  const now = new Date();
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(withdrawalRequest)
      .where(and(eq(withdrawalRequest.id, input.withdrawalId), eq(withdrawalRequest.userId, input.userId)))
      .limit(1);

    const request = rows[0];
    if (!request) {
      throw new NotFoundError("Withdrawal request", input.withdrawalId);
    }

    if (request.status !== "pending_admin") {
      throw new ConflictError("Only pending withdrawals can be canceled.");
    }

    await tx
      .update(withdrawalRequest)
      .set({
        status: "canceled",
        canceledAt: now,
      })
      .where(eq(withdrawalRequest.id, request.id));

    await tx.insert(withdrawalEvent).values({
      id: crypto.randomUUID(),
      withdrawalId: request.id,
      fromStatus: request.status,
      toStatus: "canceled",
      actorId: input.userId,
      createdAt: now,
    });

    await tx
      .update(walletAccount)
      .set({
        availableUsdCents: sql`${walletAccount.availableUsdCents} + ${request.amountUsdCents}`,
        reservedUsdCents: sql`${walletAccount.reservedUsdCents} - ${request.amountUsdCents}`,
        updatedAt: now,
      })
      .where(eq(walletAccount.userId, request.userId));

    await tx.insert(walletLedger).values({
      id: crypto.randomUUID(),
      userId: request.userId,
      type: "reserve_release",
      amountUsdCents: request.amountUsdCents,
      currency: request.currency,
      referenceType: "withdrawal",
      referenceId: request.id,
      createdAt: now,
    });

    return {
      id: request.id,
      userId: request.userId,
      amountUsdCents: request.amountUsdCents,
      currency: request.currency,
      status: "canceled",
      destination: request.destination,
      chain: request.chain ?? null,
      txHash: request.txHash ?? null,
      adminId: request.adminId ?? null,
      reason: request.reason ?? null,
      createdAt: request.createdAt.toISOString(),
      approvedAt: asIso(request.approvedAt),
      processedAt: asIso(request.processedAt),
      paidAt: asIso(request.paidAt),
      rejectedAt: asIso(request.rejectedAt),
      canceledAt: now.toISOString(),
      failedAt: asIso(request.failedAt),
    };
  });
}

export async function listAdminWithdrawals(status?: WithdrawalStatus): Promise<{ items: WithdrawalRequestResult[] }> {
  const baseQuery = db.select().from(withdrawalRequest);
  const rows = status
    ? await baseQuery.where(eq(withdrawalRequest.status, status)).orderBy(desc(withdrawalRequest.createdAt))
    : await baseQuery.orderBy(desc(withdrawalRequest.createdAt));

  return {
    items: rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      amountUsdCents: row.amountUsdCents,
      currency: row.currency,
      status: row.status,
      destination: row.destination,
      chain: row.chain ?? null,
      txHash: row.txHash ?? null,
      adminId: row.adminId ?? null,
      reason: row.reason ?? null,
      createdAt: row.createdAt.toISOString(),
      approvedAt: asIso(row.approvedAt),
      processedAt: asIso(row.processedAt),
      paidAt: asIso(row.paidAt),
      rejectedAt: asIso(row.rejectedAt),
      canceledAt: asIso(row.canceledAt),
      failedAt: asIso(row.failedAt),
    })),
  };
}

async function updateWithdrawalStatus(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  input: {
    request: typeof withdrawalRequest.$inferSelect;
    toStatus: WithdrawalStatus;
    actorId: string | null;
    reason?: string | null;
    txHash?: string | null;
    chain?: string | null;
  }
) {
  const now = new Date();
  const update: Partial<typeof withdrawalRequest.$inferInsert> = {
    status: input.toStatus,
  };

  if (input.toStatus === "approved") {
    update.approvedAt = now;
  }
  if (input.toStatus === "processing") {
    update.processedAt = now;
  }
  if (input.toStatus === "paid") {
    update.paidAt = now;
  }
  if (input.toStatus === "rejected") {
    update.rejectedAt = now;
  }
  if (input.toStatus === "canceled") {
    update.canceledAt = now;
  }
  if (input.toStatus === "failed") {
    update.failedAt = now;
  }
  if (input.reason) {
    update.reason = input.reason;
  }
  if (input.txHash !== undefined) {
    update.txHash = input.txHash;
  }
  if (input.chain !== undefined) {
    update.chain = input.chain;
  }

  await tx
    .update(withdrawalRequest)
    .set({
      ...update,
      adminId: input.actorId ?? input.request.adminId ?? null,
    })
    .where(eq(withdrawalRequest.id, input.request.id));

  await tx.insert(withdrawalEvent).values({
    id: crypto.randomUUID(),
    withdrawalId: input.request.id,
    fromStatus: input.request.status,
    toStatus: input.toStatus,
    actorId: input.actorId,
    reason: input.reason ?? null,
    createdAt: now,
  });

  return { now };
}

export async function approveWithdrawal(input: { withdrawalId: string; adminId: string }): Promise<WithdrawalRequestResult> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(withdrawalRequest)
      .where(eq(withdrawalRequest.id, input.withdrawalId))
      .limit(1);

    const request = rows[0];
    if (!request) {
      throw new NotFoundError("Withdrawal request", input.withdrawalId);
    }
    if (request.status !== "pending_admin") {
      throw new ConflictError("Only pending withdrawals can be approved.");
    }

    const { now } = await updateWithdrawalStatus(tx, {
      request,
      toStatus: "approved",
      actorId: input.adminId,
    });

    return {
      id: request.id,
      userId: request.userId,
      amountUsdCents: request.amountUsdCents,
      currency: request.currency,
      status: "approved",
      destination: request.destination,
      chain: request.chain ?? null,
      txHash: request.txHash ?? null,
      adminId: input.adminId,
      reason: request.reason ?? null,
      createdAt: request.createdAt.toISOString(),
      approvedAt: now.toISOString(),
      processedAt: asIso(request.processedAt),
      paidAt: asIso(request.paidAt),
      rejectedAt: asIso(request.rejectedAt),
      canceledAt: asIso(request.canceledAt),
      failedAt: asIso(request.failedAt),
    };
  });
}

export async function rejectWithdrawal(input: {
  withdrawalId: string;
  adminId: string;
  reason?: string | null;
}): Promise<WithdrawalRequestResult> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(withdrawalRequest)
      .where(eq(withdrawalRequest.id, input.withdrawalId))
      .limit(1);

    const request = rows[0];
    if (!request) {
      throw new NotFoundError("Withdrawal request", input.withdrawalId);
    }
    if (!["pending_admin", "approved"].includes(request.status)) {
      throw new ConflictError("Only pending or approved withdrawals can be rejected.");
    }

    const { now } = await updateWithdrawalStatus(tx, {
      request,
      toStatus: "rejected",
      actorId: input.adminId,
      reason: input.reason ?? null,
    });

    await tx
      .update(walletAccount)
      .set({
        availableUsdCents: sql`${walletAccount.availableUsdCents} + ${request.amountUsdCents}`,
        reservedUsdCents: sql`${walletAccount.reservedUsdCents} - ${request.amountUsdCents}`,
        updatedAt: now,
      })
      .where(eq(walletAccount.userId, request.userId));

    await tx.insert(walletLedger).values({
      id: crypto.randomUUID(),
      userId: request.userId,
      type: "reserve_release",
      amountUsdCents: request.amountUsdCents,
      currency: request.currency,
      referenceType: "withdrawal",
      referenceId: request.id,
      createdAt: now,
    });

    return {
      id: request.id,
      userId: request.userId,
      amountUsdCents: request.amountUsdCents,
      currency: request.currency,
      status: "rejected",
      destination: request.destination,
      chain: request.chain ?? null,
      txHash: request.txHash ?? null,
      adminId: input.adminId,
      reason: input.reason ?? null,
      createdAt: request.createdAt.toISOString(),
      approvedAt: asIso(request.approvedAt),
      processedAt: asIso(request.processedAt),
      paidAt: asIso(request.paidAt),
      rejectedAt: now.toISOString(),
      canceledAt: asIso(request.canceledAt),
      failedAt: asIso(request.failedAt),
    };
  });
}

export async function markWithdrawalProcessing(input: {
  withdrawalId: string;
  adminId: string;
}): Promise<WithdrawalRequestResult> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(withdrawalRequest)
      .where(eq(withdrawalRequest.id, input.withdrawalId))
      .limit(1);

    const request = rows[0];
    if (!request) {
      throw new NotFoundError("Withdrawal request", input.withdrawalId);
    }
    if (!["approved"].includes(request.status)) {
      throw new ConflictError("Only approved withdrawals can be moved to processing.");
    }

    const { now } = await updateWithdrawalStatus(tx, {
      request,
      toStatus: "processing",
      actorId: input.adminId,
    });

    return {
      id: request.id,
      userId: request.userId,
      amountUsdCents: request.amountUsdCents,
      currency: request.currency,
      status: "processing",
      destination: request.destination,
      chain: request.chain ?? null,
      txHash: request.txHash ?? null,
      adminId: input.adminId,
      reason: request.reason ?? null,
      createdAt: request.createdAt.toISOString(),
      approvedAt: asIso(request.approvedAt),
      processedAt: now.toISOString(),
      paidAt: asIso(request.paidAt),
      rejectedAt: asIso(request.rejectedAt),
      canceledAt: asIso(request.canceledAt),
      failedAt: asIso(request.failedAt),
    };
  });
}

export async function markWithdrawalPaid(input: {
  withdrawalId: string;
  adminId: string;
  txHash?: string | null;
  chain?: string | null;
}): Promise<WithdrawalRequestResult> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(withdrawalRequest)
      .where(eq(withdrawalRequest.id, input.withdrawalId))
      .limit(1);

    const request = rows[0];
    if (!request) {
      throw new NotFoundError("Withdrawal request", input.withdrawalId);
    }
    if (!["approved", "processing"].includes(request.status)) {
      throw new ConflictError("Only approved or processing withdrawals can be marked as paid.");
    }

    const { now } = await updateWithdrawalStatus(tx, {
      request,
      toStatus: "paid",
      actorId: input.adminId,
      txHash: input.txHash ?? null,
      chain: input.chain ?? null,
    });

    await tx
      .update(walletAccount)
      .set({
        reservedUsdCents: sql`${walletAccount.reservedUsdCents} - ${request.amountUsdCents}`,
        updatedAt: now,
      })
      .where(eq(walletAccount.userId, request.userId));

    await tx.insert(walletLedger).values({
      id: crypto.randomUUID(),
      userId: request.userId,
      type: "debit",
      amountUsdCents: request.amountUsdCents,
      currency: request.currency,
      referenceType: "withdrawal",
      referenceId: request.id,
      createdAt: now,
    });

    return {
      id: request.id,
      userId: request.userId,
      amountUsdCents: request.amountUsdCents,
      currency: request.currency,
      status: "paid",
      destination: request.destination,
      chain: input.chain ?? request.chain ?? null,
      txHash: input.txHash ?? request.txHash ?? null,
      adminId: input.adminId,
      reason: request.reason ?? null,
      createdAt: request.createdAt.toISOString(),
      approvedAt: asIso(request.approvedAt),
      processedAt: asIso(request.processedAt),
      paidAt: now.toISOString(),
      rejectedAt: asIso(request.rejectedAt),
      canceledAt: asIso(request.canceledAt),
      failedAt: asIso(request.failedAt),
    };
  });
}

export async function markWithdrawalFailed(input: {
  withdrawalId: string;
  adminId: string;
  reason?: string | null;
}): Promise<WithdrawalRequestResult> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(withdrawalRequest)
      .where(eq(withdrawalRequest.id, input.withdrawalId))
      .limit(1);

    const request = rows[0];
    if (!request) {
      throw new NotFoundError("Withdrawal request", input.withdrawalId);
    }
    if (!["approved", "processing"].includes(request.status)) {
      throw new ConflictError("Only approved or processing withdrawals can be marked as failed.");
    }

    const { now } = await updateWithdrawalStatus(tx, {
      request,
      toStatus: "failed",
      actorId: input.adminId,
      reason: input.reason ?? null,
    });

    await tx
      .update(walletAccount)
      .set({
        availableUsdCents: sql`${walletAccount.availableUsdCents} + ${request.amountUsdCents}`,
        reservedUsdCents: sql`${walletAccount.reservedUsdCents} - ${request.amountUsdCents}`,
        updatedAt: now,
      })
      .where(eq(walletAccount.userId, request.userId));

    await tx.insert(walletLedger).values({
      id: crypto.randomUUID(),
      userId: request.userId,
      type: "reserve_release",
      amountUsdCents: request.amountUsdCents,
      currency: request.currency,
      referenceType: "withdrawal",
      referenceId: request.id,
      createdAt: now,
    });

    return {
      id: request.id,
      userId: request.userId,
      amountUsdCents: request.amountUsdCents,
      currency: request.currency,
      status: "failed",
      destination: request.destination,
      chain: request.chain ?? null,
      txHash: request.txHash ?? null,
      adminId: input.adminId,
      reason: input.reason ?? null,
      createdAt: request.createdAt.toISOString(),
      approvedAt: asIso(request.approvedAt),
      processedAt: asIso(request.processedAt),
      paidAt: asIso(request.paidAt),
      rejectedAt: asIso(request.rejectedAt),
      canceledAt: asIso(request.canceledAt),
      failedAt: now.toISOString(),
    };
  });
}

async function requestReservePayout(input: {
  withdrawalId: string;
  destination: string;
  amountUsdCents: number;
}): Promise<{ payoutTxHash: string; paidAt: string }> {
  const payoutUnits = BigInt(input.amountUsdCents) * USDT_UNITS_PER_USD_CENT;
  const payload = {
    payoutId: input.withdrawalId,
    toAddress: input.destination,
    amountUsdtUnits: payoutUnits.toString(),
  };

  const controller = new AbortController();
  const timeoutId: ReturnType<typeof setTimeout> = setTimeout(
    () => controller.abort(),
    PAYOUT_REQUEST_TIMEOUT_MS
  );

  let response: Response;
  try {
    response = await fetch(`${env.PAYMENTS_RESERVE_URL}/payout`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-reserve-key": env.PAYMENTS_RESERVE_API_KEY,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Payout request timed out after ${PAYOUT_REQUEST_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    let errorBody = "";
    try {
      errorBody = await response.text();
    } catch {
      errorBody = "Unable to read error response";
    }
    throw new Error(`Reserve payout failed: ${response.status} ${errorBody}`);
  }

  const data = (await response.json()) as { payoutTxHash?: string; paidAt?: string };
  if (!data?.payoutTxHash) {
    throw new Error("Reserve payout response missing payoutTxHash");
  }

  return {
    payoutTxHash: data.payoutTxHash,
    paidAt: data.paidAt ?? new Date().toISOString(),
  };
}

export async function payoutWithdrawal(input: {
  withdrawalId: string;
  adminId: string;
}): Promise<WithdrawalRequestResult> {
  const rows = await db
    .select()
    .from(withdrawalRequest)
    .where(eq(withdrawalRequest.id, input.withdrawalId))
    .limit(1);

  const request = rows[0];
  if (!request) {
    throw new NotFoundError("Withdrawal request", input.withdrawalId);
  }
  if (!["approved", "processing"].includes(request.status)) {
    throw new ConflictError("Only approved or processing withdrawals can be paid out.");
  }

  if (request.status === "approved") {
    await db.transaction(async (tx) => {
      await updateWithdrawalStatus(tx, {
        request,
        toStatus: "processing",
        actorId: input.adminId,
      });
    });
  }

  try {
    const payout = await requestReservePayout({
      withdrawalId: request.id,
      destination: request.destination,
      amountUsdCents: request.amountUsdCents,
    });

    return markWithdrawalPaid({
      withdrawalId: request.id,
      adminId: input.adminId,
      txHash: payout.payoutTxHash,
      chain: request.chain ?? null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Payout failed";
    logger.error("Reserve payout failed", { err, withdrawalId: request.id });
    return markWithdrawalFailed({
      withdrawalId: request.id,
      adminId: input.adminId,
      reason: message,
    });
  }
}

export async function listWalletDestinations(userId: string): Promise<{ items: WalletDestination[] }> {
  const rows = await db
    .select()
    .from(walletDestination)
    .where(eq(walletDestination.userId, userId))
    .orderBy(desc(walletDestination.createdAt));

  return {
    items: rows.map((row) => ({
      id: row.id,
      label: row.label,
      address: row.address,
      chain: row.chain ?? null,
      isDefault: row.isDefault,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
  };
}

export async function createWalletDestination(input: {
  userId: string;
  label: string;
  address: string;
  chain?: string | null;
  isDefault?: boolean;
}): Promise<WalletDestination> {
  const label = input.label.trim();
  const address = input.address.trim();
  const chain = input.chain?.trim() || null;
  if (!label) {
    throw new ValidationError("Label is required.");
  }
  if (!address || address.length < 6) {
    throw new ValidationError("Address is required.");
  }

  const now = new Date();

  return db.transaction(async (tx) => {
    const counts = await tx
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(walletDestination)
      .where(eq(walletDestination.userId, input.userId));

    const shouldDefault = input.isDefault === true || (counts?.[0]?.count ?? 0) === 0;

    if (shouldDefault) {
      await tx
        .update(walletDestination)
        .set({ isDefault: false, updatedAt: now })
        .where(eq(walletDestination.userId, input.userId));
    }

    const id = crypto.randomUUID();
    await tx.insert(walletDestination).values({
      id,
      userId: input.userId,
      label,
      address,
      chain,
      isDefault: shouldDefault,
      createdAt: now,
      updatedAt: now,
    });

    return {
      id,
      label,
      address,
      chain,
      isDefault: shouldDefault,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
  });
}

export async function deleteWalletDestination(input: {
  userId: string;
  destinationId: string;
}): Promise<{ deletedId: string }> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(walletDestination)
      .where(and(eq(walletDestination.id, input.destinationId), eq(walletDestination.userId, input.userId)))
      .limit(1);

    const existing = rows[0];
    if (!existing) {
      throw new NotFoundError("Wallet destination", input.destinationId);
    }

    await tx
      .delete(walletDestination)
      .where(eq(walletDestination.id, input.destinationId));

    if (existing.isDefault) {
      const replacement = await tx
        .select()
        .from(walletDestination)
        .where(eq(walletDestination.userId, input.userId))
        .orderBy(desc(walletDestination.createdAt))
        .limit(1);

      if (replacement[0]) {
        await tx
          .update(walletDestination)
          .set({ isDefault: true, updatedAt: new Date() })
          .where(eq(walletDestination.id, replacement[0].id));
      }
    }

    return { deletedId: input.destinationId };
  });
}

export async function setDefaultWalletDestination(input: {
  userId: string;
  destinationId: string;
}): Promise<WalletDestination> {
  const now = new Date();
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(walletDestination)
      .where(and(eq(walletDestination.id, input.destinationId), eq(walletDestination.userId, input.userId)))
      .limit(1);

    const existing = rows[0];
    if (!existing) {
      throw new NotFoundError("Wallet destination", input.destinationId);
    }

    await tx
      .update(walletDestination)
      .set({ isDefault: false, updatedAt: now })
      .where(eq(walletDestination.userId, input.userId));

    await tx
      .update(walletDestination)
      .set({ isDefault: true, updatedAt: now })
      .where(eq(walletDestination.id, input.destinationId));

    return {
      id: existing.id,
      label: existing.label,
      address: existing.address,
      chain: existing.chain ?? null,
      isDefault: true,
      createdAt: existing.createdAt.toISOString(),
      updatedAt: now.toISOString(),
    };
  });
}
