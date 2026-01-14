import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../types/errors";
import { env } from "../config/env";

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
    stack?: string;
  };
}

export function errorHandler(
  error: FastifyError | AppError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  request.log.error({ error, url: request.url, method: request.method }, "Request error");

  if (error instanceof AppError) {
    const response: ErrorResponse = {
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    };

    if (env.NODE_ENV === "development") {
      response.error.stack = error.stack;
    }

    return reply.status(error.statusCode).send(response);
  }

  if (error.validation) {
    return reply.status(400).send({
      error: {
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        details: error.validation,
      },
    });
  }
  const statusCode = error.statusCode ?? 500;
  const response: ErrorResponse = {
    error: {
      code: error.code ?? "INTERNAL_SERVER_ERROR",
      message: error.message ?? "Internal server error",
    },
  };

  if (env.NODE_ENV === "development") {
    response.error.stack = error.stack;
    response.error.details = error;
  }

  return reply.status(statusCode).send(response);
}
