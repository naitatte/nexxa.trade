import type { FastifyRequest, FastifyReply, RouteHandlerMethod } from "fastify";
import { InternalServerError } from "../types/errors";

export function asyncHandler(
  handler: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>
): RouteHandlerMethod {
  return async (request, reply) => {
    try {
      return await handler(request, reply);
    } catch (error) {
      if (error && typeof error === "object" && "statusCode" in error) {
        throw error;
      }
      throw new InternalServerError(
        error instanceof Error ? error.message : "Unknown error",
        error
      );
    }
  };
}
