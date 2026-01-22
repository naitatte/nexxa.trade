import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import type { SmtpConfig } from "../types";

export function createSmtpTransporter(
  config: SmtpConfig
): Transporter<SMTPTransport.SentMessageInfo> {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure ?? config.port === 465,
    requireTLS: config.requireTLS,
    connectionTimeout: config.connectionTimeout ?? 10000,
    greetingTimeout: config.greetingTimeout ?? 10000,
    socketTimeout: config.socketTimeout ?? 20000,
    pool: config.pool ?? false,
    maxConnections: config.maxConnections ?? 5,
    maxMessages: config.maxMessages ?? 100,
    auth: {
      user: config.auth.user,
      pass: config.auth.pass,
    },
  } as SMTPTransport.Options);
}

export async function verifyConnection(
  transporter: Transporter
): Promise<boolean> {
  try {
    await transporter.verify();
    return true;
  } catch (error) {
    throw new Error(
      `Error al verificar la conexión SMTP: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
