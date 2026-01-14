import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Session } from "../features/auth";

declare module "fastify" {
  interface FastifyRequest {
    session?: Session;
  }
}

export type AuthenticatedRequest = FastifyRequest & {
  session: Session;
};
