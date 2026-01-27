import type { FastifyInstance } from "fastify";
import { registerHealthRoutes } from "./health";
import { registerAuthRoutes } from "./auth";
import { registerMembershipRoutes } from "./membership";
import { registerPaymentRoutes } from "./payments";
import { registerUploadRoutes } from "./uploads";

export function registerFeatures(app: FastifyInstance) {
  registerHealthRoutes(app);
  registerAuthRoutes(app);
  registerMembershipRoutes(app);
  registerPaymentRoutes(app);
  registerUploadRoutes(app);
}
