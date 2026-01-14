import type { FastifyInstance } from "fastify";
import { asyncHandler } from "../../utils/async-handler";
import { db } from "../../config/db";
import { sql } from "@nexxatrade/db";

export function registerHealthRoutes(app: FastifyInstance) {
  app.get(
    "/health",
    asyncHandler(async () => ({
      ok: true,
      timestamp: new Date().toISOString(),
    }))
  );

  app.get(
    "/health/ready",
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
