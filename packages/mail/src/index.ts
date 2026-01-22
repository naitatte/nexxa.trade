import { Mailer } from "./mailer";
import { createSmtpTransporter, verifyConnection } from "./transport/smtp";
import { getSmtpConfigFromEnv } from "./config/env";
import { createBetterAuthEmailHandlers } from "./better-auth";
import type { SmtpConfig, SendMailOptions, SendMailResult } from "./types";
import type { BetterAuthEmailOptions } from "./better-auth";

export { Mailer } from "./mailer";
export { createSmtpTransporter, verifyConnection } from "./transport/smtp";
export { getSmtpConfigFromEnv } from "./config/env";
export { createBetterAuthEmailHandlers } from "./better-auth";
export type {
  SmtpConfig,
  SendMailOptions,
  SendMailResult,
} from "./types";
export type { BetterAuthEmailOptions } from "./better-auth";

export function createMailer(
  config: SmtpConfig,
  defaultFrom?: string
): Mailer {
  const transporter = createSmtpTransporter(config);
  return new Mailer(transporter, defaultFrom, config.sendTimeout);
}

export function createMailerFromEnv(defaultFrom?: string): Mailer {
  const config = getSmtpConfigFromEnv();
  return createMailer(config, defaultFrom);
}
