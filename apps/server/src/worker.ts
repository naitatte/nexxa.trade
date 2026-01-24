import path from "node:path";
import { config as loadEnv } from "dotenv";

const envPath =
  process.env.SCHEDULER_ENV_PATH ??
  path.resolve(process.cwd(), ".env.scheduler");

loadEnv({ path: envPath, override: true });
process.env.APP_MODE = process.env.APP_MODE ?? "worker";

async function startWorker() {
  const { env } = await import("./config/env");
  const {
    createMembershipQueue,
    createMembershipWorker,
    registerMembershipRepeatableJobs,
  } = await import("./queues/membership");

  const queue = createMembershipQueue();
  const worker = createMembershipWorker();

  await registerMembershipRepeatableJobs(queue);

  worker.on("completed", (job) => {
    console.log(`[worker] Job completed`, {
      name: job.name,
      id: job.id,
    });
  });

  worker.on("failed", (job, error) => {
    console.error(`[worker] Job failed`, {
      name: job?.name,
      id: job?.id,
      error,
    });
  });

  const shutdown = async (signal: string) => {
    console.log(`[worker] Received ${signal}, shutting down`);
    await worker.close();
    await queue.close();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  console.log(`[worker] Membership maintenance running. Redis: ${env.REDIS_URL}`);
}

startWorker().catch((error) => {
  console.error("Failed to start worker:", error);
  process.exit(1);
});
