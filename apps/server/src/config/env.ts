import "dotenv/config";

type Env = {
  NODE_ENV: string;
  HOST: string;
  PORT: number;
  DATABASE_URL: string;
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
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
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

export const env: Env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  HOST: process.env.HOST ?? "0.0.0.0",
  PORT: Number.isNaN(port) ? 4000 : port,
  DATABASE_URL: requireEnv("DATABASE_URL"),
  BETTER_AUTH_SECRET: requireEnv("BETTER_AUTH_SECRET"),
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? `http://localhost:${Number.isNaN(port) ? 4000 : port}`,
  BETTER_AUTH_TRUSTED_ORIGINS: parseTrustedOrigins(),
  SMTP_HOST: requireEnv("SMTP_HOST"),
  SMTP_PORT: smtpPort,
  SMTP_SECURE: smtpSecure,
  SMTP_USER: requireEnv("SMTP_USER"),
  SMTP_PASS: requireEnv("SMTP_PASS"),
  SMTP_FROM: process.env.SMTP_FROM ?? requireEnv("SMTP_USER"),
  SMTP_POOL: process.env.SMTP_POOL ? getEnvBoolean("SMTP_POOL", true) : undefined,
  SMTP_MAX_CONNECTIONS: process.env.SMTP_MAX_CONNECTIONS ? getEnvNumber("SMTP_MAX_CONNECTIONS", 5) : undefined,
  SMTP_MAX_MESSAGES: process.env.SMTP_MAX_MESSAGES ? getEnvNumber("SMTP_MAX_MESSAGES", 100) : undefined,
};
