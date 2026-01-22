import type { FastifyInstance } from "fastify";
import type { OpenAPIV3 } from "openapi-types";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { env } from "../config/env";
import { openApiSchemas, openApiTags } from "../utils/openapi-schemas";

function ensureUsernameInSignUp(openapiObject: OpenAPIV3.Document): OpenAPIV3.Document {
  const signUpPath = openapiObject.paths?.["/api/auth/sign-up/email"];
  if (!signUpPath || "$ref" in signUpPath) return openapiObject;
  const post = signUpPath.post;
  if (!post || !post.requestBody || "$ref" in post.requestBody) return openapiObject;
  const content = post.requestBody.content?.["application/json"];
  if (!content || !content.schema || "$ref" in content.schema) return openapiObject;
  if (content.schema.type !== "object") return openapiObject;

  const properties = content.schema.properties ?? {};
  content.schema.properties = {
    ...properties,
    username: { type: "string" },
    displayUsername: { type: "string" },
  };

  const required = new Set(content.schema.required ?? []);
  required.add("username");
  content.schema.required = Array.from(required);
  return openapiObject;
}

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
    transformObject: (documentObject) => {
      if ("openapiObject" in documentObject) {
        return ensureUsernameInSignUp(documentObject.openapiObject as OpenAPIV3.Document);
      }
      return documentObject.swaggerObject;
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
