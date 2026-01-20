import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, openAPI, twoFactor } from "better-auth/plugins";
import { env } from "../../config/env";
import { db } from "../../config/db";
import { schema } from "@nexxatrade/db";
import { createMailerFromEnv, createBetterAuthEmailHandlers } from "@nexxatrade/mail";
import { ac, roles, type UserRole } from "./roles";

const mailer = createMailerFromEnv(env.SMTP_USER);
const emailHandlers = createBetterAuthEmailHandlers({
  mailer,
  appName: "NexxaTrade",
  defaultFrom: env.SMTP_USER,
});

export const auth = betterAuth({
  appName: "NexxaTrade",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  trustedOrigins: env.BETTER_AUTH_TRUSTED_ORIGINS,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    sendResetPassword: emailHandlers.sendResetPassword,
  },
  emailVerification: {
    sendVerificationEmail: emailHandlers.sendVerificationEmail,
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    freshAge: 60 * 10,
  },
  user: {
    changeEmail: {
      enabled: true,
    },
    additionalFields: {
      role: {
        type: ["admin", "guest", "subscriber", "networker"] as UserRole[],
        required: false,
        defaultValue: "guest",
        input: false,
      },
      membershipStatus: {
        type: "string",
        required: false,
        defaultValue: "inactive",
        input: false,
      },
      membershipTier: {
        type: "string",
        required: false,
        input: false,
      },
      membershipExpiresAt: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
  plugins: [
    admin({
      ac,
      roles,
    }),
    openAPI({
      path: "/api-docs",
    }),
    twoFactor({
      issuer: "NexxaTrade",
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
