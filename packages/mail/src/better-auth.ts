import type { Mailer } from "./mailer";
import { getVerificationEmailTemplate } from "./templates/verification";
import { getResetPasswordEmailTemplate } from "./templates/reset-password";
import { getChangeEmailOTPTemplate } from "./templates/change-email-otp";

export interface BetterAuthEmailOptions {
  mailer: Mailer;
  appName: string;
  defaultFrom?: string;
}

export function createBetterAuthEmailHandlers(options: BetterAuthEmailOptions) {
  const { mailer, appName, defaultFrom } = options;

  const normalizeVerificationUrl = (rawUrl: string): string => {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.pathname.endsWith("/api/auth/verify-email")) {
        parsed.pathname = parsed.pathname.replace(/\/api\/auth\/verify-email$/, "/verify-email");
      }
      return parsed.toString();
    } catch {
      return rawUrl;
    }
  };

  const sendVerificationEmail = async ({
    user,
    url,
  }: {
    user: { email: string; name?: string | null };
    url: string;
    token: string;
  }) => {
    const verificationUrl = normalizeVerificationUrl(url);
    const template = getVerificationEmailTemplate(
      appName,
      verificationUrl,
      user.name ?? undefined
    );

    await mailer.sendMail({
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

    await mailer.sendMail({
      from: defaultFrom,
      to: user.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  };

  const sendChangeEmailOTP = async ({
    user,
    newEmail,
    otpCode,
  }: {
    user: { email: string; name?: string | null };
    newEmail: string;
    otpCode: string;
  }) => {
    const template = getChangeEmailOTPTemplate(
      appName,
      otpCode,
      newEmail,
      user.name ?? undefined
    );

    await mailer.sendMail({
      from: defaultFrom,
      to: newEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  };

  return {
    sendVerificationEmail,
    sendResetPassword,
    sendChangeEmailOTP,
  };
}
