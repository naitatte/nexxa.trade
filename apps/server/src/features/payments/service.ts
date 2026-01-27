import crypto from "node:crypto";
import { db } from "../../config/db";
import { schema, sql, eq, and, inArray, isNull, isNotNull, gt, lte, or } from "@nexxatrade/db";
import type { MembershipTier } from "@nexxatrade/core";
import { getPaymentsConfig } from "./config";
import { deriveAddress } from "./wallet";
import { Interface, JsonRpcProvider, getAddress, id, zeroPadValue } from "ethers";
import { activateMembershipWithTx } from "../membership/service";
import { requireActiveMembershipPlan } from "../membership/plans";
import { logger } from "../../config/logger";

const { membershipPayment, paymentChainCursor } = schema;

const SWEEP_REQUEST_TIMEOUT_MS: number = 60000;
const MAX_SWEEP_RETRIES: number = 3;
const RETRY_BACKOFF_MULTIPLIER: number = 2;
const BASE_RETRY_DELAY_MS: number = 5000;

const transferInterface: Interface = new Interface([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);
const transferTopic: string = id("Transfer(address,address,uint256)");

const addressChunkSize: number = 5;

export type CreatePaymentIntentInput = {
  readonly userId: string;
  readonly tier: MembershipTier;
};

export type CreatePaymentIntentResult = {
  readonly paymentId: string;
  readonly depositAddress: string;
  readonly amountUsdCents: number;
  readonly chain: string;
};

export type PaymentStatusResult = {
  readonly paymentId: string;
  readonly status: string;
  readonly sweepStatus: string | null;
  readonly depositAddress: string | null;
  readonly amountUsdCents: number;
  readonly chain: string | null;
  readonly txHash: string | null;
  readonly confirmedAt: string | null;
  readonly sweptAt: string | null;
  readonly appliedAt: string | null;
};

export type ScanResult = {
  readonly scannedFromBlock: number;
  readonly scannedToBlock: number;
  readonly confirmedCount: number;
};

export type SweepResult = {
  readonly attemptedCount: number;
  readonly sweptCount: number;
};

export type ApplyResult = {
  readonly appliedCount: number;
};

export type PipelineResult = {
  readonly scan: ScanResult;
  readonly sweep: SweepResult;
  readonly apply: ApplyResult;
};

type PendingPaymentRow = {
  readonly id: string;
  readonly userId: string;
  readonly tier: MembershipTier;
  readonly amountUsdCents: number;
  readonly depositAddress: string;
  readonly derivationIndex: number;
};

type PendingPaymentRowDb = {
  readonly id: string;
  readonly userId: string;
  readonly tier: MembershipTier;
  readonly amountUsdCents: number;
  readonly depositAddress: string | null;
  readonly derivationIndex: number | null;
};

type ConfirmedPaymentRow = {
  readonly id: string;
  readonly userId: string;
  readonly tier: MembershipTier;
  readonly amountUsdCents: number;
  readonly depositAddress: string;
  readonly derivationIndex: number;
  readonly sweepRetryCount: number;
};

type ConfirmedPaymentRowDb = {
  readonly id: string;
  readonly userId: string;
  readonly tier: MembershipTier;
  readonly amountUsdCents: number;
  readonly depositAddress: string | null;
  readonly derivationIndex: number | null;
  readonly sweepRetryCount: number | null;
};

type SweptPaymentRow = {
  readonly id: string;
  readonly userId: string;
  readonly tier: MembershipTier;
  readonly amountUsdCents: number;
  readonly txHash: string | null;
  readonly fromAddress: string | null;
  readonly toAddress: string | null;
  readonly chain: string | null;
};

type CursorRow = {
  readonly chain: string;
  readonly contract: string;
  readonly lastScannedBlock: number;
};

type PaymentsConfig = ReturnType<typeof getPaymentsConfig>;

type RpcLog = {
  readonly data: string;
  readonly topics: readonly string[];
  readonly transactionHash: string;
};

type PaymentStatusRow = {
  readonly paymentId: string;
  readonly status: string;
  readonly sweepStatus: string | null;
  readonly depositAddress: string | null;
  readonly amountUsdCents: number;
  readonly chain: string | null;
  readonly txHash: string | null;
  readonly confirmedAt: Date | null;
  readonly sweptAt: Date | null;
  readonly appliedAt: Date | null;
};

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function createPaymentIntent(input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult> {
  const config: PaymentsConfig = getPaymentsConfig();
  const paymentId: string = crypto.randomUUID();
  const plan = await requireActiveMembershipPlan(input.tier);
  const amountUsdCents: number = plan.priceUsdCents;
  const derivationIndex: number = await allocateDerivationIndex();
  const derived: { readonly address: string; readonly derivationIndex: number } = deriveAddress({ xpub: config.xpub, derivationIndex });
  await db.insert(membershipPayment).values({
    id: paymentId,
    userId: input.userId,
    tier: input.tier,
    status: "pending",
    amountUsdCents,
    chain: config.chain,
    depositAddress: derived.address,
    derivationIndex: derived.derivationIndex,
    sweepStatus: "pending",
  });
  return { paymentId, depositAddress: derived.address, amountUsdCents, chain: config.chain };
}

export async function getPaymentStatus(input: { readonly paymentId: string; readonly userId: string }): Promise<PaymentStatusResult | null> {
  const rows: PaymentStatusRow[] = await db
    .select({
      paymentId: membershipPayment.id,
      status: membershipPayment.status,
      sweepStatus: membershipPayment.sweepStatus,
      depositAddress: membershipPayment.depositAddress,
      amountUsdCents: membershipPayment.amountUsdCents,
      chain: membershipPayment.chain,
      txHash: membershipPayment.txHash,
      confirmedAt: membershipPayment.confirmedAt,
      sweptAt: membershipPayment.sweptAt,
      appliedAt: membershipPayment.appliedAt,
    })
    .from(membershipPayment)
    .where(and(eq(membershipPayment.id, input.paymentId), eq(membershipPayment.userId, input.userId)))
    .limit(1);
  if (!rows.length) {
    return null;
  }
  const row: PaymentStatusRow = rows[0];
  return {
    paymentId: row.paymentId,
    status: row.status,
    sweepStatus: row.sweepStatus,
    depositAddress: row.depositAddress,
    amountUsdCents: row.amountUsdCents,
    chain: row.chain,
    txHash: row.txHash,
    confirmedAt: row.confirmedAt ? row.confirmedAt.toISOString() : null,
    sweptAt: row.sweptAt ? row.sweptAt.toISOString() : null,
    appliedAt: row.appliedAt ? row.appliedAt.toISOString() : null,
  };
}

export async function scanPaymentIntents(): Promise<ScanResult> {
  const config: PaymentsConfig = getPaymentsConfig();
  let provider: JsonRpcProvider;
  let latestBlock: number;
  try {
    provider = new JsonRpcProvider(config.rpcUrl);
    latestBlock = await provider.getBlockNumber();
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    logger.error("Failed to connect to RPC provider", {
      rpcUrl: config.rpcUrl,
      error: errorMessage,
    });
    throw new Error(`RPC connection failed: ${errorMessage}`);
  }
  const latestFinalizedBlock: number = Math.max(latestBlock - config.confirmations, 0);
  const pendingPayments: PendingPaymentRow[] = await getPendingPayments();
  if (!pendingPayments.length) {
    await upsertCursor({ chain: config.chain, contract: config.usdtContract, lastScannedBlock: latestFinalizedBlock });
    return { scannedFromBlock: latestFinalizedBlock, scannedToBlock: latestFinalizedBlock, confirmedCount: 0 };
  }
  const cursor: CursorRow | null = await getCursor({ chain: config.chain });
  const fallbackStart: number = Math.max(latestFinalizedBlock - config.scanBatch + 1, 0);
  const fromBlock: number = cursor ? Math.max(cursor.lastScannedBlock + 1, 0) : fallbackStart;
  const toBlock: number = Math.min(fromBlock + config.scanChunk - 1, latestFinalizedBlock);
  if (fromBlock > toBlock) {
    return { scannedFromBlock: fromBlock, scannedToBlock: toBlock, confirmedCount: 0 };
  }
  const blockChunkSize: number = Math.max(1, Math.floor(config.scanChunk / 5));
  const { confirmedCount, lastScannedBlock, error } = await confirmTransfers({
    provider,
    pendingPayments,
    fromBlock,
    toBlock,
    usdtContract: config.usdtContract,
    chain: config.chain,
    blockChunkSize,
  });
  if (error) {
    const cursorUpdated = lastScannedBlock >= fromBlock;
    if (cursorUpdated) {
      await upsertCursor({ chain: config.chain, contract: config.usdtContract, lastScannedBlock });
    }
    logger.error("Failed to confirm transfers during scan", {
      fromBlock,
      toBlock,
      lastScannedBlock,
      pendingCount: pendingPayments.length,
      cursorUpdated,
      error: error.message,
      errorBlockFrom: error.blockFrom,
      errorBlockTo: error.blockTo,
      errorChunkSize: error.chunkSize,
    });
    throw new Error(`Transfer confirmation failed: ${error.message}`);
  }
  await upsertCursor({ chain: config.chain, contract: config.usdtContract, lastScannedBlock });
  logger.info("Payment scan completed", {
    fromBlock,
    toBlock,
    confirmedCount,
    pendingCount: pendingPayments.length,
    cursorUpdatedTo: lastScannedBlock,
  });
  return { scannedFromBlock: fromBlock, scannedToBlock: toBlock, confirmedCount };
}

export async function sweepConfirmedPayments(): Promise<SweepResult> {
  const candidates: ConfirmedPaymentRow[] = await getSweepCandidates();
  if (!candidates.length) {
    return { attemptedCount: 0, sweptCount: 0 };
  }
  let attemptedCount: number = 0;
  let sweptCount: number = 0;
  for (const candidate of candidates) {
    if (candidate.sweepRetryCount >= MAX_SWEEP_RETRIES) {
      logger.warn("Sweep max retries exceeded", {
        paymentId: candidate.id,
        retryCount: candidate.sweepRetryCount,
      });
      await markSweepExhausted({ paymentId: candidate.id });
      continue;
    }
    const updated: boolean = await markSweepAttempt({ paymentId: candidate.id });
    if (!updated) {
      continue;
    }
    attemptedCount += 1;
    let sweepResult: SweepResponse | null = null;
    let sweepError: string | null = null;
    try {
      sweepResult = await requestSweep({
        paymentId: candidate.id,
        derivationIndex: candidate.derivationIndex,
        fromAddress: candidate.depositAddress,
        minUsdtUnits: toUsdtUnits({ amountUsdCents: candidate.amountUsdCents }),
      });
    } catch (err: unknown) {
      sweepError = err instanceof Error ? err.message : "Unknown error";
      logger.error("Sweep request threw an error", {
        paymentId: candidate.id,
        error: sweepError,
        retryCount: candidate.sweepRetryCount,
      });
    }
    if (!sweepResult) {
      const nextRetryDelay = calculateRetryDelay({ retryCount: candidate.sweepRetryCount });
      await markSweepFailed({ paymentId: candidate.id, error: sweepError, nextRetryDelay });
      logger.warn("Sweep failed, scheduled for retry", {
        paymentId: candidate.id,
        retryCount: candidate.sweepRetryCount + 1,
        nextRetryDelayMs: nextRetryDelay,
        error: sweepError,
      });
      continue;
    }
    logger.info("Sweep transaction successful, updating database", {
      paymentId: candidate.id,
      sweepTxHash: sweepResult.sweepTxHash,
      fundingTxHash: sweepResult.fundingTxHash,
    });
    let dbUpdateSuccess: boolean = false;
    for (let dbRetry = 0; dbRetry < 3; dbRetry++) {
      try {
        await markSweepCompleted({ paymentId: candidate.id, sweep: sweepResult });
        dbUpdateSuccess = true;
        break;
      } catch (dbErr: unknown) {
        const dbError = dbErr instanceof Error ? dbErr.message : "Unknown error";
        logger.error("Failed to update database after successful sweep", {
          paymentId: candidate.id,
          sweepTxHash: sweepResult.sweepTxHash,
          attempt: dbRetry + 1,
          error: dbError,
        });
        if (dbRetry < 2) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (dbRetry + 1)));
        }
      }
    }
    if (!dbUpdateSuccess) {
      logger.error("CRITICAL: Sweep completed but database update failed after retries", {
        paymentId: candidate.id,
        sweepTxHash: sweepResult.sweepTxHash,
        fundingTxHash: sweepResult.fundingTxHash,
        sweptAt: sweepResult.sweptAt,
      });
    }
    logger.info("Sweep completed successfully", {
      paymentId: candidate.id,
      sweepTxHash: sweepResult.sweepTxHash,
      fundingTxHash: sweepResult.fundingTxHash,
    });
    sweptCount += 1;
  }
  return { attemptedCount, sweptCount };
}

export async function applySweptPayments(): Promise<ApplyResult> {
  const sweptPayments: SweptPaymentRow[] = await getApplyCandidates();
  if (!sweptPayments.length) {
    return { appliedCount: 0 };
  }
  let appliedCount: number = 0;
  for (const payment of sweptPayments) {
    const applied: boolean = await applyPayment({ payment });
    if (applied) {
      appliedCount += 1;
    }
  }
  return { appliedCount };
}

export async function processPaymentsPipeline(): Promise<PipelineResult> {
  const scan: ScanResult = await scanPaymentIntents();
  const sweep: SweepResult = await sweepConfirmedPayments();
  const apply: ApplyResult = await applySweptPayments();
  return { scan, sweep, apply };
}

async function allocateDerivationIndex(): Promise<number> {
  const rows = await db.execute<{ value: string | number }>(
    sql`select nextval('payment_derivation_index_seq') as value`
  );
  const value: number = Number(rows[0]?.value ?? 0);
  return value;
}

async function getPendingPayments(): Promise<PendingPaymentRow[]> {
  const rawRows: PendingPaymentRowDb[] = await db
    .select({
      id: membershipPayment.id,
      userId: membershipPayment.userId,
      tier: membershipPayment.tier,
      amountUsdCents: membershipPayment.amountUsdCents,
      depositAddress: membershipPayment.depositAddress,
      derivationIndex: membershipPayment.derivationIndex,
    })
    .from(membershipPayment)
    .where(
      and(
        eq(membershipPayment.status, "pending"),
        isNotNull(membershipPayment.depositAddress),
        isNotNull(membershipPayment.derivationIndex)
      )
    );
  const rows: PendingPaymentRow[] = [];
  for (const row of rawRows) {
    if (!row.depositAddress || row.derivationIndex === null) {
      continue;
    }
    rows.push({
      id: row.id,
      userId: row.userId,
      tier: row.tier,
      amountUsdCents: row.amountUsdCents,
      depositAddress: row.depositAddress,
      derivationIndex: row.derivationIndex,
    });
  }
  return rows;
}

async function getSweepCandidates(): Promise<ConfirmedPaymentRow[]> {
  const now: Date = new Date();
  const rawRows: ConfirmedPaymentRowDb[] = await db
    .select({
      id: membershipPayment.id,
      userId: membershipPayment.userId,
      tier: membershipPayment.tier,
      amountUsdCents: membershipPayment.amountUsdCents,
      depositAddress: membershipPayment.depositAddress,
      derivationIndex: membershipPayment.derivationIndex,
      sweepRetryCount: membershipPayment.sweepRetryCount,
    })
    .from(membershipPayment)
    .where(
      and(
        eq(membershipPayment.status, "confirmed"),
        inArray(membershipPayment.sweepStatus, ["pending", "failed"]),
        isNull(membershipPayment.appliedAt),
        isNotNull(membershipPayment.depositAddress),
        isNotNull(membershipPayment.derivationIndex),
        or(
          isNull(membershipPayment.sweepRetryAfter),
          lte(membershipPayment.sweepRetryAfter, now)
        )
      )
    )
    .limit(10);
  const rows: ConfirmedPaymentRow[] = [];
  for (const row of rawRows) {
    if (!row.depositAddress || row.derivationIndex === null) {
      continue;
    }
    rows.push({
      id: row.id,
      userId: row.userId,
      tier: row.tier,
      amountUsdCents: row.amountUsdCents,
      depositAddress: row.depositAddress,
      derivationIndex: row.derivationIndex,
      sweepRetryCount: row.sweepRetryCount ?? 0,
    });
  }
  return rows;
}

async function getApplyCandidates(): Promise<SweptPaymentRow[]> {
  const rows: SweptPaymentRow[] = await db
    .select({
      id: membershipPayment.id,
      userId: membershipPayment.userId,
      tier: membershipPayment.tier,
      amountUsdCents: membershipPayment.amountUsdCents,
      txHash: membershipPayment.txHash,
      fromAddress: membershipPayment.fromAddress,
      toAddress: membershipPayment.toAddress,
      chain: membershipPayment.chain,
    })
    .from(membershipPayment)
    .where(and(eq(membershipPayment.sweepStatus, "swept"), isNull(membershipPayment.appliedAt)))
    .limit(10);
  return rows;
}

async function getCursor(input: { readonly chain: string }): Promise<CursorRow | null> {
  const rows: CursorRow[] = await db
    .select({
      chain: paymentChainCursor.chain,
      contract: paymentChainCursor.contract,
      lastScannedBlock: paymentChainCursor.lastScannedBlock,
    })
    .from(paymentChainCursor)
    .where(eq(paymentChainCursor.chain, input.chain))
    .limit(1);
  return rows.length ? rows[0] : null;
}

async function upsertCursor(input: { readonly chain: string; readonly contract: string; readonly lastScannedBlock: number }): Promise<void> {
  const existing: CursorRow | null = await getCursor({ chain: input.chain });
  if (!existing) {
    await db.insert(paymentChainCursor).values({
      chain: input.chain,
      contract: input.contract,
      lastScannedBlock: input.lastScannedBlock,
    });
    return;
  }
  await db
    .update(paymentChainCursor)
    .set({ lastScannedBlock: input.lastScannedBlock })
    .where(eq(paymentChainCursor.chain, input.chain));
}

type ConfirmTransfersError = {
  readonly message: string;
  readonly blockFrom: number;
  readonly blockTo: number;
  readonly chunkSize: number;
};

type ConfirmTransfersResult = {
  readonly confirmedCount: number;
  readonly lastScannedBlock: number;
  readonly error?: ConfirmTransfersError;
};

async function confirmTransfers(input: {
  readonly provider: JsonRpcProvider;
  readonly pendingPayments: PendingPaymentRow[];
  readonly fromBlock: number;
  readonly toBlock: number;
  readonly usdtContract: string;
  readonly chain: string;
  readonly blockChunkSize: number;
}): Promise<ConfirmTransfersResult> {
  const paymentMap: Map<string, PendingPaymentRow> = buildPaymentMap({ payments: input.pendingPayments });
  const confirmedAddresses: Set<string> = new Set();
  const addresses: string[] = collectDepositAddresses({ payments: input.pendingPayments });
  const addressChunks: string[][] = chunkAddresses({ addresses });
  let confirmedCount: number = 0;
  const blockChunkSize: number = Math.max(1, input.blockChunkSize);
  for (let blockStart = input.fromBlock; blockStart <= input.toBlock; blockStart += blockChunkSize) {
    const blockEnd: number = Math.min(blockStart + blockChunkSize - 1, input.toBlock);
    for (const chunk of addressChunks) {
      const topicAddresses: string[] = mapTopicAddresses({ addresses: chunk });
      const topics: Array<string | string[] | null> = [transferTopic, null, topicAddresses];
      let logs: RpcLog[];
      try {
        logs = await input.provider.getLogs({
          address: input.usdtContract,
          topics,
          fromBlock: blockStart,
          toBlock: blockEnd,
        });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        return {
          confirmedCount,
          lastScannedBlock: blockStart - 1,
          error: {
            message: errorMessage,
            blockFrom: blockStart,
            blockTo: blockEnd,
            chunkSize: chunk.length,
          },
        };
      }
      for (const log of logs) {
        const decoded: { from: string; to: string; value: bigint } = transferInterface.decodeEventLog("Transfer", log.data, log.topics) as unknown as { from: string; to: string; value: bigint };
        const fromAddress: string = getAddress(decoded.from as string);
        const toAddress: string = getAddress(decoded.to as string);
        const value: bigint = decoded.value as bigint;
        const addressKey: string = toAddress.toLowerCase();
        const payment: PendingPaymentRow | undefined = paymentMap.get(addressKey);
        if (!payment) {
          continue;
        }
        if (confirmedAddresses.has(addressKey)) {
          logger.warn("Additional transfer detected to already-confirmed address", {
            paymentId: payment.id,
            toAddress,
            txHash: log.transactionHash,
            valueUnits: value.toString(),
          });
          continue;
        }
        const minimumUnits: bigint = toUsdtUnits({ amountUsdCents: payment.amountUsdCents });
        if (value < minimumUnits) {
          logger.info("Transfer below minimum amount, skipping", {
            paymentId: payment.id,
            toAddress,
            txHash: log.transactionHash,
            receivedUnits: value.toString(),
            minimumUnits: minimumUnits.toString(),
          });
          continue;
        }
        const overpaymentUnits: bigint = value - minimumUnits;
        if (overpaymentUnits > 0n) {
          logger.info("Overpayment detected", {
            paymentId: payment.id,
            toAddress,
            txHash: log.transactionHash,
            expectedUnits: minimumUnits.toString(),
            receivedUnits: value.toString(),
            overpaymentUnits: overpaymentUnits.toString(),
          });
        }
        const updated: number = await confirmPayment({
          paymentId: payment.id,
          chain: input.chain,
          txHash: log.transactionHash,
          fromAddress,
          toAddress,
          receivedUnits: value,
          expectedUnits: minimumUnits,
        });
        if (updated > 0) {
          confirmedCount += 1;
          confirmedAddresses.add(addressKey);
          paymentMap.delete(addressKey);
          logger.info("Payment confirmed", {
            paymentId: payment.id,
            toAddress,
            txHash: log.transactionHash,
            receivedUnits: value.toString(),
          });
        }
      }
    }
  }
  return { confirmedCount, lastScannedBlock: input.toBlock };
}

async function confirmPayment(input: {
  readonly paymentId: string;
  readonly chain: string;
  readonly txHash: string;
  readonly fromAddress: string;
  readonly toAddress: string;
  readonly receivedUnits: bigint;
  readonly expectedUnits: bigint;
}): Promise<number> {
  const now: Date = new Date();
  const overpaymentUnits: bigint = input.receivedUnits > input.expectedUnits ? input.receivedUnits - input.expectedUnits : 0n;
  const result: Array<{ id: string }> = await db
    .update(membershipPayment)
    .set({
      status: "confirmed",
      chain: input.chain,
      txHash: input.txHash,
      fromAddress: input.fromAddress,
      toAddress: input.toAddress,
      confirmedAt: now,
      receivedUnits: input.receivedUnits.toString(),
      expectedUnits: input.expectedUnits.toString(),
      overpaymentUnits: overpaymentUnits.toString(),
    })
    .where(and(eq(membershipPayment.id, input.paymentId), eq(membershipPayment.status, "pending")))
    .returning({ id: membershipPayment.id });
  return result.length;
}

function buildPaymentMap(input: { readonly payments: PendingPaymentRow[] }): Map<string, PendingPaymentRow> {
  const map: Map<string, PendingPaymentRow> = new Map();
  for (const payment of input.payments) {
    const key: string = getAddress(payment.depositAddress).toLowerCase();
    map.set(key, payment);
  }
  return map;
}

function collectDepositAddresses(input: { readonly payments: PendingPaymentRow[] }): string[] {
  const addresses: string[] = [];
  for (const payment of input.payments) {
    addresses.push(payment.depositAddress);
  }
  return addresses;
}

function chunkAddresses(input: { readonly addresses: string[] }): string[][] {
  const chunks: string[][] = [];
  let index: number = 0;
  while (index < input.addresses.length) {
    const slice: string[] = input.addresses.slice(index, index + addressChunkSize);
    chunks.push(slice);
    index += addressChunkSize;
  }
  return chunks;
}

function mapTopicAddresses(input: { readonly addresses: string[] }): string[] {
  const topics: string[] = [];
  for (const address of input.addresses) {
    topics.push(toTopicAddress({ address }));
  }
  return topics;
}

function toTopicAddress(input: { readonly address: string }): string {
  const normalized: string = getAddress(input.address);
  const padded: string = zeroPadValue(normalized, 32);
  return padded;
}

function toUsdtUnits(input: { readonly amountUsdCents: number }): bigint {
  const units: bigint = BigInt(input.amountUsdCents) * 10000n;
  return units;
}

async function markSweepAttempt(input: { readonly paymentId: string }): Promise<boolean> {
  const now: Date = new Date();
  const result: Array<{ id: string }> = await db
    .update(membershipPayment)
    .set({ sweepStatus: "funding", sweepAttemptedAt: now })
    .where(
      and(
        eq(membershipPayment.id, input.paymentId),
        inArray(membershipPayment.sweepStatus, ["pending", "failed"]),
        isNull(membershipPayment.appliedAt)
      )
    )
    .returning({ id: membershipPayment.id });
  return result.length > 0;
}

type SweepResponse = {
  readonly sweepTxHash: string;
  readonly fundingTxHash?: string;
  readonly sweptAt: string;
  readonly fundedAt?: string;
};

async function requestSweep(input: {
  readonly paymentId: string;
  readonly derivationIndex: number;
  readonly fromAddress: string;
  readonly minUsdtUnits: bigint;
}): Promise<SweepResponse | null> {
  const config: PaymentsConfig = getPaymentsConfig();
  const payload: { paymentId: string; derivationIndex: number; fromAddress: string; minUsdtUnits: string } = {
    paymentId: input.paymentId,
    derivationIndex: input.derivationIndex,
    fromAddress: input.fromAddress,
    minUsdtUnits: input.minUsdtUnits.toString(),
  };
  const controller: AbortController = new AbortController();
  const timeoutId: ReturnType<typeof setTimeout> = setTimeout(() => controller.abort(), SWEEP_REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${config.reserveUrl}/sweep`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-reserve-key": config.reserveApiKey,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      logger.error("Sweep request timed out", {
        paymentId: input.paymentId,
        timeoutMs: SWEEP_REQUEST_TIMEOUT_MS,
      });
      throw new Error(`Sweep request timed out after ${SWEEP_REQUEST_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
  if (!response.ok) {
    let errorBody: string = "";
    try {
      errorBody = await response.text();
    } catch {
      errorBody = "Unable to read error response";
    }
    logger.error("Sweep request failed with non-OK status", {
      paymentId: input.paymentId,
      status: response.status,
      errorBody,
    });
    return null;
  }
  const data: SweepResponse = (await response.json()) as SweepResponse;
  if (!data?.sweepTxHash) {
    logger.error("Sweep response missing sweepTxHash", {
      paymentId: input.paymentId,
      response: data,
    });
    return null;
  }
  return data;
}

async function markSweepCompleted(input: { readonly paymentId: string; readonly sweep: SweepResponse }): Promise<void> {
  const sweptAt: Date = new Date(input.sweep.sweptAt);
  const fundedAt: Date | null = input.sweep.fundedAt ? new Date(input.sweep.fundedAt) : null;
  await db
    .update(membershipPayment)
    .set({
      sweepStatus: "swept",
      sweepTxHash: input.sweep.sweepTxHash,
      fundingTxHash: input.sweep.fundingTxHash ?? null,
      sweptAt,
      fundedAt,
    })
    .where(eq(membershipPayment.id, input.paymentId));
}

async function markSweepFailed(input: { readonly paymentId: string; readonly error: string | null; readonly nextRetryDelay: number }): Promise<void> {
  const now: Date = new Date();
  const retryAfter: Date = new Date(now.getTime() + input.nextRetryDelay);
  await db
    .update(membershipPayment)
    .set({
      sweepStatus: "failed",
      sweepRetryCount: sql`COALESCE(${membershipPayment.sweepRetryCount}, 0) + 1`,
      sweepRetryAfter: retryAfter,
      sweepLastError: input.error,
    })
    .where(eq(membershipPayment.id, input.paymentId));
}

async function markSweepExhausted(input: { readonly paymentId: string }): Promise<void> {
  await db
    .update(membershipPayment)
    .set({ sweepStatus: "exhausted" })
    .where(eq(membershipPayment.id, input.paymentId));
}

function calculateRetryDelay(input: { readonly retryCount: number }): number {
  const delay: number = BASE_RETRY_DELAY_MS * Math.pow(RETRY_BACKOFF_MULTIPLIER, input.retryCount);
  return Math.min(delay, 3600000);
}

async function applyPayment(input: { readonly payment: SweptPaymentRow }): Promise<boolean> {
  const now: Date = new Date();
  return db.transaction(async (tx: DbTransaction): Promise<boolean> => {
    const rows: Array<{ appliedAt: Date | null }> = await tx
      .select({ appliedAt: membershipPayment.appliedAt })
      .from(membershipPayment)
      .where(eq(membershipPayment.id, input.payment.id))
      .limit(1);
    if (!rows.length) {
      return false;
    }
    if (rows[0].appliedAt) {
      return false;
    }
    await activateMembershipWithTx({
      tx,
      input: {
        userId: input.payment.userId,
        tier: input.payment.tier,
        amountUsdCents: input.payment.amountUsdCents,
        paymentId: input.payment.id,
        txHash: input.payment.txHash ?? undefined,
        chain: input.payment.chain ?? undefined,
        fromAddress: input.payment.fromAddress ?? undefined,
        toAddress: input.payment.toAddress ?? undefined,
        reason: "payment_confirmed",
      },
    });
    await tx.update(membershipPayment).set({ appliedAt: now }).where(eq(membershipPayment.id, input.payment.id));
    return true;
  });
}
