import type { FastifyInstance } from "fastify";
import { asyncHandler } from "../../utils/async-handler";
import { db } from "../../config/db";
import { sql } from "@nexxatrade/db";
import { env } from "../../config/env";
import Redis from "ioredis";

type DependencyCheckResult = {
  ok: boolean;
  status: string;
  error?: string;
};

const RESERVE_HEALTH_TIMEOUT_MS = 2000;

const getErrorMessage = (error: unknown): string => (
  error instanceof Error ? error.message : "Unknown error"
);

const checkDatabase = async (): Promise<DependencyCheckResult> => {
  try {
    await db.execute(sql`SELECT 1`);
    return { ok: true, status: "connected" };
  } catch (error) {
    return { ok: false, status: "disconnected", error: getErrorMessage(error) };
  }
};

const checkRedis = async (): Promise<DependencyCheckResult> => {
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 0,
    enableReadyCheck: false,
    connectTimeout: 1000,
  });
  try {
    const result = await client.ping();
    return result === "PONG"
      ? { ok: true, status: "connected" }
      : { ok: false, status: `unexpected:${result}` };
  } catch (error) {
    return { ok: false, status: "disconnected", error: getErrorMessage(error) };
  } finally {
    client.disconnect();
  }
};

const checkReserve = async (): Promise<DependencyCheckResult> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RESERVE_HEALTH_TIMEOUT_MS);
  try {
    const response = await fetch(`${env.PAYMENTS_RESERVE_URL}/health`, {
      signal: controller.signal,
    });
    if (!response.ok) {
      return {
        ok: false,
        status: `unhealthy:${response.status}`,
        error: `HTTP ${response.status}`,
      };
    }
    const data = (await response.json().catch(() => null)) as { status?: string } | null;
    if (data?.status === "ok") {
      return { ok: true, status: "connected" };
    }
    return { ok: false, status: "unhealthy", error: "Unexpected response" };
  } catch (error) {
    return { ok: false, status: "disconnected", error: getErrorMessage(error) };
  } finally {
    clearTimeout(timeout);
  }
};

export function registerHealthRoutes(app: FastifyInstance) {
  app.get(
    "/health",
    {
      schema: {
        tags: ["System"],
        summary: "Liveness probe",
        response: {
          200: {
            type: "object",
            properties: {
              ok: { type: "boolean" },
              timestamp: { type: "string", format: "date-time" },
            },
          },
        },
      },
    },
    asyncHandler(async () => ({
      ok: true,
      timestamp: new Date().toISOString(),
    }))
  );

  app.get(
    "/health/ready",
    {
      schema: {
        tags: ["System"],
        summary: "Readiness probe",
        response: {
          200: {
            type: "object",
            properties: {
              ok: { type: "boolean" },
              timestamp: { type: "string", format: "date-time" },
              database: { type: "string" },
              redis: { type: "string" },
              reserve: { type: "string" },
              errors: {
                type: "object",
                properties: {
                  database: { type: "string" },
                  redis: { type: "string" },
                  reserve: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    asyncHandler(async () => {
      const [databaseResult, redisResult, reserveResult] = await Promise.all([
        checkDatabase(),
        checkRedis(),
        checkReserve(),
      ]);

      const errors: Record<string, string> = {};
      if (databaseResult.error) errors.database = databaseResult.error;
      if (redisResult.error) errors.redis = redisResult.error;
      if (reserveResult.error) errors.reserve = reserveResult.error;

      return {
        ok: databaseResult.ok && redisResult.ok && reserveResult.ok,
        timestamp: new Date().toISOString(),
        database: databaseResult.status,
        redis: redisResult.status,
        reserve: reserveResult.status,
        ...(Object.keys(errors).length ? { errors } : {}),
      };
    })
  );
}
