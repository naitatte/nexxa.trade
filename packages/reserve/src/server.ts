import Fastify, { type FastifyServerOptions, type FastifyInstance } from "fastify";
import { getReserveConfig } from "./config";
import { registerReserveRoutes } from "./routes";

async function startServer(): Promise<void> {
  const config: ReturnType<typeof getReserveConfig> = getReserveConfig();
  const loggerConfig: Exclude<FastifyServerOptions["logger"], boolean | undefined> = {
    level: "info",
  };
  const app: FastifyInstance = Fastify({
    logger: loggerConfig,
    requestIdHeader: "x-request-id",
    requestIdLogLabel: "reqId",
    disableRequestLogging: false,
    bodyLimit: 16 * 1024,
    trustProxy: true,
  });
  registerReserveRoutes(app);
  app.log.info({ host: config.host, port: config.port }, "Starting reserve server");
  await app.listen({ port: config.port, host: config.host });
}

startServer().catch((error: unknown) => {
  console.error("reserve server failed to start", error);
  process.exit(1);
});
