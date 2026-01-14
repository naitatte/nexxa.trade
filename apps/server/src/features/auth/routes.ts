import type { FastifyInstance } from "fastify";
import { auth } from "./auth";
import { asyncHandler } from "../../utils/async-handler";
import { InternalServerError } from "../../types/errors";

export function registerAuthRoutes(app: FastifyInstance) {
  app.get(
    "/api/auth/api-docs/openapi.json",
    asyncHandler(async (request, reply) => {
      const schema = await auth.api.generateOpenAPISchema();
      if (!schema) {
        throw new InternalServerError("OpenAPI schema unavailable");
      }
      reply.type("application/json").send(schema);
    })
  );

  app.route({
    method: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    url: "/api/auth/*",
    handler: asyncHandler(async (request, reply) => {
      const protocol =
        request.headers["x-forwarded-proto"] ||
        ((request.server as { https?: boolean }).https ? "https" : "http");
      const host = request.headers.host || "localhost";
      const url = new URL(request.url, `${protocol}://${host}`);

      const headers = new Headers();
      for (const [key, value] of Object.entries(request.headers)) {
        if (!value) continue;
        if (Array.isArray(value)) {
          value.forEach((entry) => headers.append(key, entry));
        } else {
          headers.append(key, value.toString());
        }
      }

      const init: RequestInit = {
        method: request.method,
        headers,
      };

      if (
        request.method !== "GET" &&
        request.method !== "HEAD" &&
        request.body !== undefined
      ) {
        if (
          typeof request.body === "string" ||
          request.body instanceof Uint8Array
        ) {
          init.body = request.body as string | Uint8Array;
        } else {
          if (!headers.has("content-type")) {
            headers.set("content-type", "application/json");
          }
          init.body = JSON.stringify(request.body);
        }
      }

      const response = await auth.handler(new Request(url.toString(), init));
      reply.status(response.status);

      response.headers.forEach((value, key) => {
        reply.header(key, value);
      });

      reply.send(response.body ? await response.text() : null);
    }),
  });
}
