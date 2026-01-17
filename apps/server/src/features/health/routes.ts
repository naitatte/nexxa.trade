import type { FastifyInstance } from "fastify";
import { asyncHandler } from "../../utils/async-handler";
import { db } from "../../config/db";
import { sql } from "@nexxatrade/db";

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
              error: { type: "string" },
            },
          },
        },
      },
    },
    asyncHandler(async () => {
      try {
        await db.execute(sql`SELECT 1`);
        return {
          ok: true,
          timestamp: new Date().toISOString(),
          database: "connected",
        };
      } catch (error) {
        return {
          ok: false,
          timestamp: new Date().toISOString(),
          database: "disconnected",
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    })
  );
}
