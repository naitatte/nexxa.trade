import type { SmtpConfig } from "../types";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function getEnvNumber(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) {
    return defaultValue;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

function getEnvBoolean(name: string, defaultValue: boolean): boolean {
  const value = process.env[name];
  if (!value) {
    return defaultValue;
  }
  return value.toLowerCase() === "true" || value === "1";
}

export function getSmtpConfigFromEnv(): SmtpConfig {
  const port = getEnvNumber("SMTP_PORT", 587);
  const secure = getEnvBoolean("SMTP_SECURE", port === 465);

  return {
    host: requireEnv("SMTP_HOST"),
    port,
    secure,
    requireTLS: process.env.SMTP_REQUIRE_TLS
      ? getEnvBoolean("SMTP_REQUIRE_TLS", false)
      : undefined,
    connectionTimeout: getEnvNumber("SMTP_CONNECTION_TIMEOUT", 10000),
    greetingTimeout: getEnvNumber("SMTP_GREETING_TIMEOUT", 10000),
    socketTimeout: getEnvNumber("SMTP_SOCKET_TIMEOUT", 20000),
    sendTimeout: getEnvNumber("SMTP_SEND_TIMEOUT", 15000),
    auth: {
      user: requireEnv("SMTP_USER"),
      pass: requireEnv("SMTP_PASS"),
    },
    pool: process.env.SMTP_POOL
      ? getEnvBoolean("SMTP_POOL", true)
      : undefined,
    maxConnections: process.env.SMTP_MAX_CONNECTIONS
      ? getEnvNumber("SMTP_MAX_CONNECTIONS", 5)
      : undefined,
    maxMessages: process.env.SMTP_MAX_MESSAGES
      ? getEnvNumber("SMTP_MAX_MESSAGES", 100)
      : undefined,
  };
}
