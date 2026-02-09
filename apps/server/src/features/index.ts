import type { FastifyInstance } from "fastify";
import { registerHealthRoutes } from "./health";
import { registerAuthRoutes } from "./auth";
import { registerMembershipRoutes } from "./membership";
import { registerPaymentRoutes } from "./payments";
import { registerUploadRoutes } from "./uploads";
import { registerSignalRoutes } from "./signals";
import { registerReferralRoutes } from "./referrals/routes";

export function registerFeatures(app: FastifyInstance) {
  registerHealthRoutes(app);
  registerAuthRoutes(app);
  registerMembershipRoutes(app);
  registerPaymentRoutes(app);
  registerUploadRoutes(app);
  registerSignalRoutes(app);
  registerReferralRoutes(app);
}
