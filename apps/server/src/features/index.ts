import type { FastifyInstance } from "fastify";
import { registerHealthRoutes } from "./health";
import { registerAuthRoutes } from "./auth";
import { registerMembershipRoutes } from "./membership";
import { registerUploadRoutes } from "./uploads";

export function registerFeatures(app: FastifyInstance) {
  registerHealthRoutes(app);
  registerAuthRoutes(app);
  registerMembershipRoutes(app);
  registerUploadRoutes(app);
}
