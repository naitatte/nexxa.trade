import type { FastifyInstance } from "fastify";
import { registerHealthRoutes } from "./health";
import { registerAuthRoutes } from "./auth";

export function registerFeatures(app: FastifyInstance) {
  registerHealthRoutes(app);
  registerAuthRoutes(app);
}
