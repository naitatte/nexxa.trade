import type { FastifyInstance } from "fastify";
import { registerHealthRoutes } from "./health";
import { registerAuthRoutes } from "./auth";
import { registerMembershipRoutes } from "./membership";

export function registerFeatures(app: FastifyInstance) {
  registerHealthRoutes(app);
  registerAuthRoutes(app);
  registerMembershipRoutes(app);
}
