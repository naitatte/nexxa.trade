import "dotenv/config";

type Env = {
  NODE_ENV: string;
  HOST: string;
  PORT: number;
  DATABASE_URL: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  BETTER_AUTH_TRUSTED_ORIGINS?: string[];
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

const port = Number.parseInt(process.env.PORT ?? "4000", 10);

// Parse trusted origins from env or use defaults for development
const parseTrustedOrigins = (): string[] => {
  if (process.env.BETTER_AUTH_TRUSTED_ORIGINS) {
    return process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(",").map((origin) => origin.trim());
  }
  // Default trusted origins for development
  return ["http://localhost:3000", "http://localhost:3001"];
};

export const env: Env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  HOST: process.env.HOST ?? "0.0.0.0",
  PORT: Number.isNaN(port) ? 4000 : port,
  DATABASE_URL: requireEnv("DATABASE_URL"),
  BETTER_AUTH_SECRET: requireEnv("BETTER_AUTH_SECRET"),
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? `http://localhost:${Number.isNaN(port) ? 4000 : port}`,
  BETTER_AUTH_TRUSTED_ORIGINS: parseTrustedOrigins(),
};
