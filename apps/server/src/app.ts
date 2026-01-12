import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { registerAuthRoutes } from "./auth/routes";
import { registerHealthRoutes } from "./routes/health";
import { env } from "./config/env";

export function buildApp() {
  const app = Fastify({ logger: true });

  app.register(cors, { origin: true, credentials: true });
  app.register(multipart);

  // Swagger configuration for OpenAPI spec generation
  app.register(swagger, {
    openapi: {
      openapi: "3.0.0",
      info: {
        title: "NexxaTrade API",
        description: "API documentation for NexxaTrade",
        version: "1.0.0",
      },
      servers: [
        {
          url: env.BETTER_AUTH_URL,
          description: "Development server",
        },
      ],
    },
  });

  app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: false,
      url: "/api/auth/api-docs/openapi.json",
    },
  });

  registerHealthRoutes(app);
  registerAuthRoutes(app);

  return app;
}
