import "dotenv/config";
import path from "node:path";

type Env = {
  NODE_ENV: string;
  HOST: string;
  PORT: number;
  DATABASE_URL: string;
  REDIS_URL: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  BETTER_AUTH_TRUSTED_ORIGINS?: string[];
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_SECURE: boolean;
  SMTP_USER: string;
  SMTP_PASS: string;
  SMTP_FROM: string;
  SMTP_POOL?: boolean;
  SMTP_MAX_CONNECTIONS?: number;
  SMTP_MAX_MESSAGES?: number;
  MEMBERSHIP_DELETION_DAYS: number;
  MEMBERSHIP_EXPIRE_EVERY_MINUTES: number;
  MEMBERSHIP_COMPRESS_EVERY_MINUTES: number;
  PAYMENTS_XPUB_PATH: string;
  PAYMENTS_CHAIN: string;
  PAYMENTS_RPC_URL: string;
  PAYMENTS_USDT_CONTRACT: string;
  PAYMENTS_CONFIRMATIONS: number;
  PAYMENTS_SCAN_BATCH: number;
  PAYMENTS_SCAN_CHUNK: number;
  PAYMENTS_SCAN_INTERVAL_SECONDS: number;
  PAYMENTS_RESERVE_URL: string;
  PAYMENTS_RESERVE_API_KEY: string;
  PAYMENTS_TREASURY_ADDRESS: string;
  SIGNALS_INGEST_KEY: string;
};

const isWorker = process.env.APP_MODE === "worker";

function requireEnv(name: string, options?: { optional?: boolean }): string {
  const value = process.env[name];
  if (!value) {
    if (options?.optional) {
      return "";
    }
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

const port = Number.parseInt(process.env.PORT ?? "4000", 10);

const parseTrustedOrigins = (): string[] => {
  if (process.env.BETTER_AUTH_TRUSTED_ORIGINS) {
    return process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(",").map((origin) => origin.trim());
  }
  return ["http://localhost:3000", "http://localhost:3001"];
};

const getEnvNumber = (name: string, defaultValue: number): number => {
  const value = process.env[name];
  if (!value) {
    return defaultValue;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
};

const getEnvBoolean = (name: string, defaultValue: boolean): boolean => {
  const value = process.env[name];
  if (!value) {
    return defaultValue;
  }
  return value.toLowerCase() === "true" || value === "1";
};

const smtpPort = getEnvNumber("SMTP_PORT", 587);
const smtpSecure = getEnvBoolean("SMTP_SECURE", smtpPort === 465);
const defaultXpubPath = path.resolve(process.cwd(), "keys/xpub.txt");
const signalsIngestKey: string = process.env.SIGNALS_INGEST_KEY ?? "";

export const env: Env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  HOST: process.env.HOST ?? "0.0.0.0",
  PORT: Number.isNaN(port) ? 4000 : port,
  DATABASE_URL: requireEnv("DATABASE_URL"),
  REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",
  BETTER_AUTH_SECRET: requireEnv("BETTER_AUTH_SECRET", { optional: isWorker }),
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? `http://localhost:${Number.isNaN(port) ? 4000 : port}`,
  BETTER_AUTH_TRUSTED_ORIGINS: parseTrustedOrigins(),
  SMTP_HOST: requireEnv("SMTP_HOST", { optional: isWorker }),
  SMTP_PORT: smtpPort,
  SMTP_SECURE: smtpSecure,
  SMTP_USER: requireEnv("SMTP_USER", { optional: isWorker }),
  SMTP_PASS: requireEnv("SMTP_PASS", { optional: isWorker }),
  SMTP_FROM: process.env.SMTP_FROM ?? requireEnv("SMTP_USER", { optional: isWorker }),
  SMTP_POOL: process.env.SMTP_POOL ? getEnvBoolean("SMTP_POOL", true) : undefined,
  SMTP_MAX_CONNECTIONS: process.env.SMTP_MAX_CONNECTIONS ? getEnvNumber("SMTP_MAX_CONNECTIONS", 5) : undefined,
  SMTP_MAX_MESSAGES: process.env.SMTP_MAX_MESSAGES ? getEnvNumber("SMTP_MAX_MESSAGES", 100) : undefined,
  MEMBERSHIP_DELETION_DAYS: getEnvNumber("MEMBERSHIP_DELETION_DAYS", 7),
  MEMBERSHIP_EXPIRE_EVERY_MINUTES: getEnvNumber("MEMBERSHIP_EXPIRE_EVERY_MINUTES", 15),
  MEMBERSHIP_COMPRESS_EVERY_MINUTES: getEnvNumber("MEMBERSHIP_COMPRESS_EVERY_MINUTES", 60),
  PAYMENTS_XPUB_PATH: process.env.PAYMENTS_XPUB_PATH ?? defaultXpubPath,
  PAYMENTS_CHAIN: process.env.PAYMENTS_CHAIN ?? "bsc",
  PAYMENTS_RPC_URL: requireEnv("PAYMENTS_RPC_URL"),
  PAYMENTS_USDT_CONTRACT: requireEnv("PAYMENTS_USDT_CONTRACT"),
  PAYMENTS_CONFIRMATIONS: getEnvNumber("PAYMENTS_CONFIRMATIONS", 12),
  PAYMENTS_SCAN_BATCH: getEnvNumber("PAYMENTS_SCAN_BATCH", 5000),
  PAYMENTS_SCAN_CHUNK: getEnvNumber("PAYMENTS_SCAN_CHUNK", 2500),
  PAYMENTS_SCAN_INTERVAL_SECONDS: getEnvNumber("PAYMENTS_SCAN_INTERVAL_SECONDS", 30),
  PAYMENTS_RESERVE_URL: requireEnv("PAYMENTS_RESERVE_URL"),
  PAYMENTS_RESERVE_API_KEY: requireEnv("PAYMENTS_RESERVE_API_KEY"),
  PAYMENTS_TREASURY_ADDRESS: requireEnv("PAYMENTS_TREASURY_ADDRESS"),
  SIGNALS_INGEST_KEY: signalsIngestKey,
};
