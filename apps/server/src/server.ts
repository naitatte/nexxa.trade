import { buildApp } from "./app";
import { env } from "./config/env";

async function startServer() {
  try {
    const app = await buildApp();

    await app.listen({ port: env.PORT, host: env.HOST });

    app.log.info(`Server listening on http://${env.HOST}:${env.PORT}`);
    app.log.info(`Environment: ${env.NODE_ENV}`);
    app.log.info(`API Documentation: http://${env.HOST}:${env.PORT}/docs`);

    const shutdown = async (signal: string) => {
      app.log.info(`Received ${signal}, shutting down gracefully`);
      try {
        await app.close();
        process.exit(0);
      } catch (error) {
        app.log.error({ error }, "Error during shutdown");
        process.exit(1);
      }
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
