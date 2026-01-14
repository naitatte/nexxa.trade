import type { FastifyInstance } from "fastify";
import { errorHandler } from "./error-handler";
import { requestLogger, requestStartTimes } from "./request-logger";

export function registerMiddlewares(app: FastifyInstance) {
  app.addHook("onRequest", requestLogger);

  app.addHook("onResponse", async (request, reply) => {
    const startTime = requestStartTimes.get(request);
    if (startTime) {
      const duration = Date.now() - startTime;
      request.log.info(
        {
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode,
          duration: `${duration}ms`,
        },
        "Request completed"
      );
    }
  });

  app.setErrorHandler(errorHandler);

  app.addHook("onError", async (request, reply, error) => {
    request.log.error({ error }, "Unhandled error");
  });
}
