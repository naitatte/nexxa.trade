import Fastify, { type FastifyServerOptions } from "fastify";
import type { OpenAPIV3 } from "openapi-types";
import { env } from "./config/env";
import { registerPlugins } from "./plugins";
import { registerMiddlewares } from "./middleware";
import { registerRoutes } from "./routes";
import { auth } from "./features/auth/auth";
import {
  normalizeBetterAuthSchema,
  mergePaths,
  mergeTags,
  mergeComponents,
  mergeSecurity,
  adaptSchemasToDb,
} from "./utils/openapi-merge";

function dedupeOperationIds(document: OpenAPIV3.Document) {
  const used = new Map<string, number>();
  const sanitize = (value: string) => value.replace(/[^a-zA-Z0-9_]/g, "_");

  Object.entries(document.paths || {}).forEach(([path, pathItem]) => {
    if (!pathItem) return;
    const methods = ["get", "post", "put", "patch", "delete", "options", "head"];
    methods.forEach((method) => {
      const operation = (pathItem as Record<string, any>)[method];
      if (!operation || !operation.operationId) return;
      const id = operation.operationId as string;
      const count = used.get(id) ?? 0;
      if (count === 0) {
        used.set(id, 1);
        return;
      }
      const suffix = sanitize(`${method}_${path}`);
      const nextId = `${id}_${suffix}`;
      operation.operationId = nextId;
      used.set(id, count + 1);
      used.set(nextId, 1);
    });
  });
}

export async function buildApp() {
  const loggerConfig: Exclude<FastifyServerOptions["logger"], boolean | undefined> = {
    level: env.NODE_ENV === "production" ? "info" : "debug",
  };

  if (env.NODE_ENV === "development") {
    loggerConfig.transport = {
      target: "pino-pretty",
      options: {
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
      },
    };
  }

  const app = Fastify({
    logger: loggerConfig,
    requestIdHeader: "x-request-id",
    requestIdLogLabel: "reqId",
    disableRequestLogging: false,
    bodyLimit: 6 * 1024 * 1024,
  });

  await registerPlugins(app);

  registerMiddlewares(app);

  registerRoutes(app);

  app.addHook("onReady", async () => {
    if (typeof app.swagger === "function") {
      try {
        const api = auth.api as typeof auth.api & {
          generateOpenAPISchema: () => Promise<OpenAPIV3.Document>;
        };

        if (api.generateOpenAPISchema) {
          const betterAuthSchema = normalizeBetterAuthSchema(
            await api.generateOpenAPISchema()
          );

          const document = app.swagger() as OpenAPIV3.Document;

          document.tags = mergeTags(document.tags, betterAuthSchema.tags);
          document.paths = mergePaths(document.paths, betterAuthSchema.paths);
          document.components = mergeComponents(
            document.components,
            betterAuthSchema.components
          );
          document.security = mergeSecurity(
            document.security,
            betterAuthSchema.security
          );

          adaptSchemasToDb(document);
          dedupeOperationIds(document);

          app.log.info("Better Auth OpenAPI schema integrated successfully");
        }
      } catch (error) {
        app.log.warn(
          { err: error },
          "Failed to integrate Better Auth OpenAPI schema"
        );
      }
    }

    app.log.info("Server is ready");
  });

  app.addHook("onClose", async () => {
    app.log.info("Server is closing");
  });

  return app;
}
