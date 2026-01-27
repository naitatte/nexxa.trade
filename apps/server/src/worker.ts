import path from "node:path";
import { config as loadEnv } from "dotenv";
import type { Job, Queue } from "bullmq";

const envPath =
  process.env.SCHEDULER_ENV_PATH ??
  path.resolve(process.cwd(), ".env.scheduler");

loadEnv({ path: envPath, override: true });
process.env.APP_MODE = process.env.APP_MODE ?? "worker";

type EnvModule = typeof import("./config/env");
type LoggerModule = typeof import("./config/logger");
type MembershipQueueModule = typeof import("./queues/membership");
type PaymentsQueueModule = typeof import("./queues/payments");

type RepeatableQueueConfig = {
  queueName: string;
  queue: Queue;
  expectedJobs: string[];
  register: (queue: Queue) => Promise<void>;
};

const REPEATABLE_JOBS_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const REDIS_WRITE_CHECK_KEY = "nexxa:worker:writecheck";

async function assertRedisWritable(redisUrl: string, logger: LoggerModule["logger"]): Promise<void> {
  const RedisModule = await import("ioredis");
  const Redis = RedisModule.default;
  const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
  try {
    const info = await redis.info("replication");
    const roleMatch = info.match(/role:(\w+)/);
    const role = roleMatch?.[1];
    if (role && role !== "master") {
      logger.error("Redis is read-only, refusing to start worker", { role, redisUrl });
      throw new Error(`Redis role is ${role}`);
    }
    await redis.set(REDIS_WRITE_CHECK_KEY, "1", "EX", 10);
  } finally {
    await redis.quit();
  }
}

async function ensureRepeatableJobs(config: RepeatableQueueConfig, logger: LoggerModule["logger"]): Promise<void> {
  try {
    const jobs = await config.queue.getRepeatableJobs();
    const existing = new Set(jobs.map((job) => job.name));
    const missing = config.expectedJobs.filter((name) => !existing.has(name));
    if (missing.length > 0) {
      logger.warn("Repeatable jobs missing, re-registering", {
        queue: config.queueName,
        missing,
      });
      await config.register(config.queue);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("Failed to verify repeatable jobs", {
      queue: config.queueName,
      error: message,
    });
  }
}

async function startWorker(): Promise<void> {
  const envModule: EnvModule = await import("./config/env");
  const loggerModule: LoggerModule = await import("./config/logger");
  const membershipModule: MembershipQueueModule = await import("./queues/membership");
  const paymentsModule: PaymentsQueueModule = await import("./queues/payments");
  const env: EnvModule["env"] = envModule.env;
  const logger: LoggerModule["logger"] = loggerModule.logger;
  await assertRedisWritable(env.REDIS_URL, logger);
  const queue: ReturnType<MembershipQueueModule["createMembershipQueue"]> = membershipModule.createMembershipQueue();
  const worker: ReturnType<MembershipQueueModule["createMembershipWorker"]> = membershipModule.createMembershipWorker();
  const paymentsQueue: ReturnType<PaymentsQueueModule["createPaymentsQueue"]> = paymentsModule.createPaymentsQueue();
  const paymentsWorker: ReturnType<PaymentsQueueModule["createPaymentsWorker"]> = paymentsModule.createPaymentsWorker();
  await membershipModule.registerMembershipRepeatableJobs(queue);
  await paymentsModule.registerPaymentsRepeatableJobs(paymentsQueue);
  const repeatableConfigs: RepeatableQueueConfig[] = [
    {
      queueName: "membership-maintenance",
      queue,
      expectedJobs: ["expire-memberships", "compress-memberships"],
      register: membershipModule.registerMembershipRepeatableJobs,
    },
    {
      queueName: "payments-processing",
      queue: paymentsQueue,
      expectedJobs: ["process-payments"],
      register: paymentsModule.registerPaymentsRepeatableJobs,
    },
  ];
  await Promise.all(repeatableConfigs.map((config) => ensureRepeatableJobs(config, logger)));
  const reconciliationTimer = setInterval(() => {
    void Promise.all(repeatableConfigs.map((config) => ensureRepeatableJobs(config, logger)));
  }, REPEATABLE_JOBS_CHECK_INTERVAL_MS);
  reconciliationTimer.unref();
  worker.on("completed", (job: Job) => {
    logger.info("Worker job completed", {
      name: job.name,
      id: job.id,
      attemptsMade: job.attemptsMade,
    });
  });
  worker.on("failed", (job: Job | undefined, error: Error) => {
    logger.error("Worker job failed", {
      name: job?.name,
      id: job?.id,
      attemptsMade: job?.attemptsMade,
      maxAttempts: job?.opts.attempts,
      error: error.message,
      stack: error.stack,
    });
  });
  paymentsWorker.on("completed", (job: Job) => {
    logger.info("Worker job completed", {
      name: job.name,
      id: job.id,
      attemptsMade: job.attemptsMade,
    });
  });
  paymentsWorker.on("failed", (job: Job | undefined, error: Error) => {
    logger.error("Worker job failed", {
      name: job?.name,
      id: job?.id,
      attemptsMade: job?.attemptsMade,
      maxAttempts: job?.opts.attempts,
      error: error.message,
      stack: error.stack,
    });
  });
  const shutdown = async (signal: string) => {
    logger.info("Worker received shutdown signal", { signal });
    clearInterval(reconciliationTimer);
    await worker.close();
    await queue.close();
    await paymentsWorker.close();
    await paymentsQueue.close();
    process.exit(0);
  };
  process.on("SIGTERM", (): void => { void shutdown("SIGTERM"); });
  process.on("SIGINT", (): void => { void shutdown("SIGINT"); });
  logger.info("Membership maintenance running", { redisUrl: env.REDIS_URL });
  logger.info("Payments processing running", { reserveUrl: env.PAYMENTS_RESERVE_URL });
}

startWorker().catch(async (error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  try {
    const loggerModule: LoggerModule = await import("./config/logger");
    loggerModule.logger.error("Failed to start worker", { error: message });
  } catch {
    console.error("Failed to start worker:", error);
  }
  process.exit(1);
});
