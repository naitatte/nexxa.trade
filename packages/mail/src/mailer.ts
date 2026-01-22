import type { Transporter } from "nodemailer";
import type { SendMailOptions, SendMailResult } from "./types";

export class Mailer {
  private transporter: Transporter;
  private defaultFrom?: string;
  private sendTimeoutMs?: number;

  constructor(
    transporter: Transporter,
    defaultFrom?: string,
    sendTimeoutMs?: number
  ) {
    this.transporter = transporter;
    this.defaultFrom = defaultFrom;
    this.sendTimeoutMs = sendTimeoutMs;
  }

  async sendMail(options: SendMailOptions): Promise<SendMailResult> {
    try {
      const sendPromise = this.transporter.sendMail({
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

      let timeoutId: NodeJS.Timeout | undefined;
      const info = this.sendTimeoutMs
        ? await Promise.race([
            sendPromise,
            new Promise<never>((_, reject) => {
              timeoutId = setTimeout(() => {
                reject(
                  new Error(
                    `SMTP send timed out after ${this.sendTimeoutMs}ms`
                  )
                );
              }, this.sendTimeoutMs);
              timeoutId.unref?.();
            }),
          ])
        : await sendPromise;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

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
