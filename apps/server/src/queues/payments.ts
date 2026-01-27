import { Queue, Worker, type Job } from "bullmq";
import { env } from "../config/env";
import { processPaymentsPipeline } from "../features/payments";

const QUEUE_NAME: string = "payments-processing";
const JOB_RETRY_ATTEMPTS = 3;
const JOB_RETRY_BACKOFF_MS = 1000;

const connection: { url: string } = { url: env.REDIS_URL };

export const createPaymentsQueue = (): Queue => new Queue(QUEUE_NAME, { connection });

export const createPaymentsWorker = (): Worker =>
  new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      if (job.name === "process-payments") {
        return processPaymentsPipeline();
      }
      return null;
    },
    { connection }
  );

export async function registerPaymentsRepeatableJobs(queue: Queue): Promise<void> {
  const intervalMs: number = env.PAYMENTS_SCAN_INTERVAL_SECONDS * 1000;
  await queue.add(
    "process-payments",
    {},
    {
      jobId: "process-payments",
      repeat: { every: intervalMs },
      attempts: JOB_RETRY_ATTEMPTS,
      backoff: { type: "exponential", delay: JOB_RETRY_BACKOFF_MS },
      removeOnComplete: true,
    }
  );
}
