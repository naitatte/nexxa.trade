import type { FastifyInstance } from "fastify";
import { auth } from "./index";

export function registerAuthRoutes(app: FastifyInstance) {
  app.get("/api/auth/api-docs/openapi.json", async (request, reply) => {
    try {
      const schema = await auth.api.generateOpenAPISchema();
      if (!schema) {
        request.log.error("OpenAPI schema generation returned null");
        reply.status(500).send({ error: "OpenAPI schema unavailable" });
        return;
      }
      reply.type("application/json").send(schema);
    } catch (error) {
      request.log.error({ error }, "OpenAPI schema generation failed");
      reply.status(500).send({ error: "OpenAPI schema generation failed" });
    }
  });

  app.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    async handler(request, reply) {
      const url = new URL(request.url, `http://${request.headers.host}`);

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

      if (request.method !== "GET" && request.method !== "HEAD" && request.body !== undefined) {
        if (typeof request.body === "string" || request.body instanceof Uint8Array) {
          init.body = request.body as string | Uint8Array;
        } else {
          if (!headers.has("content-type")) {
            headers.set("content-type", "application/json");
          }
          init.body = JSON.stringify(request.body);
        }
      }

      try {
        const response = await auth.handler(new Request(url.toString(), init));
        reply.status(response.status);
        response.headers.forEach((value, key) => reply.header(key, value));
        reply.send(response.body ? await response.text() : null);
      } catch (error) {
        request.log.error({ error }, "Authentication handler failed");
        reply.status(500).send({ error: "Internal authentication error", code: "AUTH_FAILURE" });
      }
    },
  });
}
