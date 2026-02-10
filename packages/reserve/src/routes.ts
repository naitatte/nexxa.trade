import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getReserveConfig } from "./config";
import { sweepUsdt, SweepError, payoutUsdt, PayoutError } from "./signer";

type SweepBody = {
  readonly paymentId: string;
  readonly derivationIndex: number;
  readonly fromAddress: string;
  readonly minUsdtUnits: string;
};

type PayoutBody = {
  readonly payoutId: string;
  readonly toAddress: string;
  readonly amountUsdtUnits: string;
};

type RateLimitEntry = {
  readonly count: number;
  readonly resetAt: number;
};

const rateLimitMap: Map<string, RateLimitEntry> = new Map();
const RATE_LIMIT_WINDOW_MS: number = 60000;
const RATE_LIMIT_MAX_REQUESTS: number = 30;
const ALLOWED_IPS: Set<string> = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

function checkRateLimit(ip: string): boolean {
  const now: number = Date.now();
  const entry: RateLimitEntry | undefined = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  rateLimitMap.set(ip, { count: entry.count + 1, resetAt: entry.resetAt });
  return true;
}

function cleanupRateLimitMap(): void {
  const now: number = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(ip);
    }
  }
}

setInterval(cleanupRateLimitMap, RATE_LIMIT_WINDOW_MS);

function getClientIp(request: FastifyRequest): string {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return request.ip || "unknown";
}

function isAllowedIp(ip: string, allowedCidrs: string[]): boolean {
  if (ALLOWED_IPS.has(ip)) {
    return true;
  }
  for (const cidr of allowedCidrs) {
    if (cidr === ip) {
      return true;
    }
  }
  return false;
}

function validateSweepBody(body: unknown): { valid: true; data: SweepBody } | { valid: false; error: string } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be an object" };
  }
  const b = body as Record<string, unknown>;
  if (typeof b.paymentId !== "string" || b.paymentId.length === 0 || b.paymentId.length > 100) {
    return { valid: false, error: "paymentId must be a non-empty string up to 100 characters" };
  }
  if (typeof b.derivationIndex !== "number" || !Number.isInteger(b.derivationIndex) || b.derivationIndex < 0) {
    return { valid: false, error: "derivationIndex must be a non-negative integer" };
  }
  if (typeof b.fromAddress !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(b.fromAddress)) {
    return { valid: false, error: "fromAddress must be a valid address" };
  }
  if (typeof b.minUsdtUnits !== "string" || !/^\d+$/.test(b.minUsdtUnits)) {
    return { valid: false, error: "minUsdtUnits must be a string containing only digits" };
  }
  try {
    const units = BigInt(b.minUsdtUnits);
    if (units <= 0n) {
      return { valid: false, error: "minUsdtUnits must be greater than 0" };
    }
  } catch {
    return { valid: false, error: "minUsdtUnits must be a valid number" };
  }
  return {
    valid: true,
    data: {
      paymentId: b.paymentId as string,
      derivationIndex: b.derivationIndex as number,
      fromAddress: b.fromAddress as string,
      minUsdtUnits: b.minUsdtUnits as string,
    },
  };
}

function validatePayoutBody(body: unknown): { valid: true; data: PayoutBody } | { valid: false; error: string } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be an object" };
  }
  const b = body as Record<string, unknown>;
  if (typeof b.payoutId !== "string" || b.payoutId.length === 0 || b.payoutId.length > 100) {
    return { valid: false, error: "payoutId must be a non-empty string up to 100 characters" };
  }
  if (typeof b.toAddress !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(b.toAddress)) {
    return { valid: false, error: "toAddress must be a valid address" };
  }
  if (typeof b.amountUsdtUnits !== "string" || !/^\d+$/.test(b.amountUsdtUnits)) {
    return { valid: false, error: "amountUsdtUnits must be a string containing only digits" };
  }
  try {
    const units = BigInt(b.amountUsdtUnits);
    if (units <= 0n) {
      return { valid: false, error: "amountUsdtUnits must be greater than 0" };
    }
  } catch {
    return { valid: false, error: "amountUsdtUnits must be a valid number" };
  }
  return {
    valid: true,
    data: {
      payoutId: b.payoutId as string,
      toAddress: b.toAddress as string,
      amountUsdtUnits: b.amountUsdtUnits as string,
    },
  };
}

export function registerReserveRoutes(app: FastifyInstance): void {
  app.get(
    "/health",
    {
      schema: {
        tags: ["Health"],
        summary: "Health check",
        response: {
          200: {
            type: "object",
            required: ["status"],
            properties: {
              status: { type: "string" },
            },
          },
        },
      },
    },
    async (): Promise<{ status: string }> => ({ status: "ok" })
  );
  app.post(
    "/sweep",
    {
      schema: {
        tags: ["Payments"],
        summary: "Sweep a confirmed deposit",
        body: {
          type: "object",
          required: ["paymentId", "derivationIndex", "fromAddress", "minUsdtUnits"],
          properties: {
            paymentId: { type: "string", maxLength: 100 },
            derivationIndex: { type: "number", minimum: 0 },
            fromAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
            minUsdtUnits: { type: "string", pattern: "^\\d+$" },
          },
        },
        response: {
          200: {
            type: "object",
            required: ["sweepTxHash", "sweptAt"],
            properties: {
              sweepTxHash: { type: "string" },
              fundingTxHash: { type: "string" },
              sweptAt: { type: "string" },
              fundedAt: { type: "string" },
            },
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
              code: { type: "string" },
            },
          },
          401: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
          403: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
          429: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
          500: {
            type: "object",
            properties: {
              error: { type: "string" },
              code: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply): Promise<unknown> => {
      const config: ReturnType<typeof getReserveConfig> = getReserveConfig();
      const clientIp: string = getClientIp(request);
      if (config.allowedIps.length > 0 && !isAllowedIp(clientIp, config.allowedIps)) {
        request.log.warn({ clientIp }, "Request from non-allowed IP");
        return reply.status(403).send({ error: "Forbidden" });
      }
      if (!checkRateLimit(clientIp)) {
        request.log.warn({ clientIp }, "Rate limit exceeded");
        return reply.status(429).send({ error: "Too many requests" });
      }
      const headerValue: string | undefined = request.headers["x-reserve-key"] as string | undefined;
      if (!headerValue || headerValue !== config.apiKey) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const validation = validateSweepBody(request.body);
      if (!validation.valid) {
        return reply.status(400).send({ error: validation.error, code: "VALIDATION_ERROR" });
      }
      const body: SweepBody = validation.data;
      let minUsdtUnits: bigint;
      try {
        minUsdtUnits = BigInt(body.minUsdtUnits);
      } catch {
        return reply.status(400).send({ error: "Invalid minUsdtUnits format", code: "INVALID_AMOUNT" });
      }
      try {
        const result: Awaited<ReturnType<typeof sweepUsdt>> = await sweepUsdt({
          paymentId: body.paymentId,
          derivationIndex: body.derivationIndex,
          fromAddress: body.fromAddress,
          minUsdtUnits,
        });
        request.log.info({ paymentId: body.paymentId, sweepTxHash: result.sweepTxHash }, "Sweep completed");
        return result;
      } catch (err: unknown) {
        if (err instanceof SweepError) {
          request.log.error({ paymentId: body.paymentId, code: err.code, error: err.message }, "Sweep failed");
          const isClientError = ["INVALID_PAYMENT_ID", "INVALID_DERIVATION_INDEX", "DERIVATION_INDEX_OUT_OF_RANGE", "INVALID_FROM_ADDRESS", "INVALID_MIN_USDT_UNITS", "ADDRESS_MISMATCH", "INSUFFICIENT_BALANCE"].includes(err.code);
          return reply.status(isClientError ? 400 : 500).send({ error: err.message, code: err.code });
        }
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        request.log.error({ paymentId: body.paymentId, error: errorMessage }, "Unexpected sweep error");
        return reply.status(500).send({ error: "Internal server error", code: "INTERNAL_ERROR" });
      }
    }
  );

  app.post(
    "/payout",
    {
      schema: {
        tags: ["Payments"],
        summary: "Send a USDT payout from treasury",
        body: {
          type: "object",
          required: ["payoutId", "toAddress", "amountUsdtUnits"],
          properties: {
            payoutId: { type: "string", maxLength: 100 },
            toAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
            amountUsdtUnits: { type: "string", pattern: "^\\d+$" },
          },
        },
        response: {
          200: {
            type: "object",
            required: ["payoutTxHash", "paidAt"],
            properties: {
              payoutTxHash: { type: "string" },
              paidAt: { type: "string" },
            },
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
              code: { type: "string" },
            },
          },
          401: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
          403: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
          429: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
          500: {
            type: "object",
            properties: {
              error: { type: "string" },
              code: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply): Promise<unknown> => {
      const config: ReturnType<typeof getReserveConfig> = getReserveConfig();
      const clientIp: string = getClientIp(request);
      if (config.allowedIps.length > 0 && !isAllowedIp(clientIp, config.allowedIps)) {
        request.log.warn({ clientIp }, "Request from non-allowed IP");
        return reply.status(403).send({ error: "Forbidden" });
      }
      if (!checkRateLimit(clientIp)) {
        request.log.warn({ clientIp }, "Rate limit exceeded");
        return reply.status(429).send({ error: "Too many requests" });
      }
      const headerValue: string | undefined = request.headers["x-reserve-key"] as string | undefined;
      if (!headerValue || headerValue !== config.apiKey) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const validation = validatePayoutBody(request.body);
      if (!validation.valid) {
        return reply.status(400).send({ error: validation.error, code: "INVALID_PAYLOAD" });
      }
      try {
        const result = await payoutUsdt({
          payoutId: validation.data.payoutId,
          toAddress: validation.data.toAddress,
          amountUsdtUnits: BigInt(validation.data.amountUsdtUnits),
        });
        return reply.send(result);
      } catch (err: unknown) {
        if (err instanceof PayoutError) {
          const isClientError = [
            "INVALID_PAYOUT_ID",
            "INVALID_TO_ADDRESS",
            "INVALID_AMOUNT",
            "ADDRESS_MISMATCH",
            "INSUFFICIENT_BALANCE",
          ].includes(err.code);
          const status = isClientError ? 400 : 500;
          return reply.status(status).send({ error: err.message, code: err.code });
        }
        request.log.error({ err }, "Unexpected payout error");
        return reply.status(500).send({ error: "Payout failed", code: "PAYOUT_FAILED" });
      }
    }
  );
}
