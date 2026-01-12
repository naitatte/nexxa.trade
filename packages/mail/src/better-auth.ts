import type { Mailer } from "./mailer";
import { getVerificationEmailTemplate } from "./templates/verification";
import { getResetPasswordEmailTemplate } from "./templates/reset-password";

export interface BetterAuthEmailOptions {
  mailer: Mailer;
  appName: string;
  defaultFrom?: string;
}

export function createBetterAuthEmailHandlers(options: BetterAuthEmailOptions) {
  const { mailer, appName, defaultFrom } = options;

  const sendVerificationEmail = async ({
    user,
    url,
  }: {
    user: { email: string; name?: string | null };
    url: string;
    token: string;
  }) => {
    const template = getVerificationEmailTemplate(
      appName,
      url,
      user.name ?? undefined
    );

    void mailer.sendMail({
      from: defaultFrom,
      to: user.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  };

  const sendResetPassword = async ({
    user,
    url,
  }: {
    user: { email: string; name?: string | null };
    url: string;
    token: string;
  }) => {
    const template = getResetPasswordEmailTemplate(
      appName,
      url,
      user.name ?? undefined
    );

    void mailer.sendMail({
      from: defaultFrom,
      to: user.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  };

  return {
    sendVerificationEmail,
    sendResetPassword,
  };
}
