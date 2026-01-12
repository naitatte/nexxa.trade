import { buildApp } from "./app";
import { env } from "./config/env";

const app = buildApp();

app
  .listen({ port: env.PORT, host: env.HOST })
  .then((address) => {
    app.log.info(`Server listening on ${address}`);
  })
  .catch((error) => {
    app.log.error(error, "Failed to start server");
    process.exit(1);
  });
