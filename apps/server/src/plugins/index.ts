import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { env } from "../config/env";
import { openApiSchemas, openApiTags } from "../utils/openapi-schemas";

export async function registerPlugins(app: FastifyInstance) {
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024,
    },
  });
  await app.register(swagger, {
    openapi: {
      openapi: "3.0.0",
      info: {
        title: "NexxaTrade API",
        description: "API documentation for NexxaTrade",
        version: "1.0.0",
      },
      tags: openApiTags,
      servers: [
        {
          url: env.BETTER_AUTH_URL,
          description: "Development server",
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    },
  });

  for (const [schemaId, schema] of Object.entries(openApiSchemas)) {
    app.addSchema({ $id: schemaId, ...schema });
  }

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: false,
      url: "/api/auth/api-docs/openapi.json",
    },
  });
}
