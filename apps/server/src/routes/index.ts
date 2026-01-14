import type { FastifyInstance } from "fastify";
import { registerFeatures } from "../features";

export function registerRoutes(app: FastifyInstance) {
  registerFeatures(app);
}
