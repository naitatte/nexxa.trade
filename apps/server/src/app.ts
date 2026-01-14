import Fastify, { type FastifyServerOptions } from "fastify";
import { env } from "./config/env";
import { registerPlugins } from "./plugins";
import { registerMiddlewares } from "./middleware";
import { registerRoutes } from "./routes";

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
  });

  await registerPlugins(app);

  registerMiddlewares(app);

  registerRoutes(app);

  app.addHook("onReady", async () => {
    app.log.info("Server is ready");
  });

  app.addHook("onClose", async () => {
    app.log.info("Server is closing");
  });

  return app;
}
