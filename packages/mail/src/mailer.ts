import type { Transporter } from "nodemailer";
import type { SendMailOptions, SendMailResult } from "./types";

export class Mailer {
  private transporter: Transporter;
  private defaultFrom?: string;

  constructor(transporter: Transporter, defaultFrom?: string) {
    this.transporter = transporter;
    this.defaultFrom = defaultFrom;
  }

  async sendMail(options: SendMailOptions): Promise<SendMailResult> {
    try {
      const info = await this.transporter.sendMail({
        from: options.from ?? this.defaultFrom,
        to: options.to,
        cc: options.cc,
        bcc: options.bcc,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments,
        replyTo: options.replyTo,
      });

      return {
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
        pending: info.pending,
        response: info.response,
      };
    } catch (error) {
      throw new Error(
        `Error al enviar email: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async sendTextMail(
    to: string | string[],
    subject: string,
    text: string,
    options?: Omit<SendMailOptions, "to" | "subject" | "text">
  ): Promise<SendMailResult> {
    return this.sendMail({
      ...options,
      to,
      subject,
      text,
    });
  }

  async sendHtmlMail(
    to: string | string[],
    subject: string,
    html: string,
    options?: Omit<SendMailOptions, "to" | "subject" | "html">
  ): Promise<SendMailResult> {
    return this.sendMail({
      ...options,
      to,
      subject,
      html,
    });
  }

  async close(): Promise<void> {
    this.transporter.close();
  }
}
