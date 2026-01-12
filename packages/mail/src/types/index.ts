import type { Attachment } from "nodemailer/lib/mailer";

export interface SmtpConfig {
  host: string;
  port: number;
  secure?: boolean;
  auth: {
    user: string;
    pass: string;
  };
  pool?: boolean;
  maxConnections?: number;
  maxMessages?: number;
}

export interface SendMailOptions {
  from?: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: Attachment[];
  replyTo?: string | string[];
}

export interface SendMailResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
  pending?: string[];
  response?: string;
}
