import { Queue, Worker } from "bullmq";
import { env } from "../config/env";
import {
  MEMBERSHIP_COMPRESS_EVERY_MINUTES,
  MEMBERSHIP_EXPIRE_EVERY_MINUTES,
} from "../features/membership/config";
import { compressInactiveUsers, expireMemberships } from "../features/membership/service";

const QUEUE_NAME = "membership-maintenance";

const connection = { url: env.REDIS_URL };

export const createMembershipQueue = () =>
  new Queue(QUEUE_NAME, { connection });

export const createMembershipWorker = () =>
  new Worker(
    QUEUE_NAME,
    async (job) => {
      switch (job.name) {
        case "expire-memberships":
          return expireMemberships();
        case "compress-memberships":
          return compressInactiveUsers();
        default:
          return null;
      }
    },
    { connection }
  );

export async function registerMembershipRepeatableJobs(queue: Queue) {
  const expireEveryMs = MEMBERSHIP_EXPIRE_EVERY_MINUTES * 60 * 1000;
  const compressEveryMs = MEMBERSHIP_COMPRESS_EVERY_MINUTES * 60 * 1000;

  await queue.add(
    "expire-memberships",
    {},
    {
      jobId: "expire-memberships",
      repeat: { every: expireEveryMs },
      removeOnComplete: true,
    }
  );

  await queue.add(
    "compress-memberships",
    {},
    {
      jobId: "compress-memberships",
      repeat: { every: compressEveryMs },
      removeOnComplete: true,
    }
  );
}
