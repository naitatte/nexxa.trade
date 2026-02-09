import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { auth } from "./auth";
import { asyncHandler } from "../../utils/async-handler";
import { InternalServerError } from "../../types/errors";
import {
  generateChangeEmailOTP,
  verifyChangeEmailOTP,
} from "./change-email-otp";
import { createMailerFromEnv, createBetterAuthEmailHandlers } from "@nexxatrade/mail";
import { env } from "../../config/env";
import { db } from "../../config/db";
import { schema, and, eq, gt } from "@nexxatrade/db";
import {
  resolveSponsorByRefCode,
  sendInactiveSponsorReferralNotice,
  upsertReferralLink,
} from "../referrals/service";

const OTP_RESEND_COOLDOWN_SECONDS = 60;

const mailer = createMailerFromEnv(env.SMTP_FROM);
const emailHandlers = createBetterAuthEmailHandlers({
  mailer,
  appName: "NexxaTrade",
  defaultFrom: env.SMTP_FROM,
});

function applyAuthHeaders(reply: FastifyReply, headers?: Headers | null) {
  if (!headers) return;
  if (typeof headers.getSetCookie === "function") {
    const cookies = headers.getSetCookie();
    if (cookies.length) {
      reply.header("set-cookie", cookies);
    }
  }
  headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") return;
    reply.header(key, value);
  });
}

function buildFetchHeaders(request: FastifyRequest): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (!value) continue;
    if (Array.isArray(value)) {
      value.forEach((entry) => headers.append(key, entry));
    } else {
      headers.append(key, value.toString());
    }
  }
  return headers;
}

function buildRequestInit(request: FastifyRequest, headers: Headers): RequestInit {
  const init: RequestInit = { method: request.method, headers };
  if (request.method === "GET" || request.method === "HEAD" || request.body === undefined) {
    return init;
  }
  if (typeof request.body === "string" || request.body instanceof Uint8Array) {
    init.body = request.body as string | Uint8Array;
  } else {
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    init.body = JSON.stringify(request.body);
  }
  return init;
}

function applyResponseHeaders(reply: FastifyReply, headers: Headers) {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  const setCookies = typeof getSetCookie === "function" ? getSetCookie.call(headers) : [];
  if (setCookies.length > 0) {
    reply.header("set-cookie", setCookies);
  } else {
    const setCookie = headers.get("set-cookie");
    if (setCookie) {
      reply.header("set-cookie", setCookie);
    }
  }
  headers.forEach((value: string, key: string) => {
    if (key.toLowerCase() === "set-cookie") return;
    reply.header(key, value);
  });
}

export function registerAuthRoutes(app: FastifyInstance) {
  app.post(
    "/api/auth/sign-up/email",
    {
      schema: { hide: true },
    },
    asyncHandler(async (request, reply) => {
      const body = (request.body ?? {}) as Record<string, unknown>;
      const rawRefCode = typeof body.refCode === "string" ? body.refCode : "";
      const refCode = rawRefCode.trim();

      const sponsor = refCode ? await resolveSponsorByRefCode(refCode) : null;

      const authPayload = { ...body };
      delete authPayload.refCode;

      const protocol =
        request.headers["x-forwarded-proto"] ||
        ((request.server as { https?: boolean }).https ? "https" : "http");
      const host = request.headers.host || "localhost";
      const url = new URL(request.url, `${protocol}://${host}`);
      const headers = buildFetchHeaders(request);
      if (!headers.has("content-type")) {
        headers.set("content-type", "application/json");
      }

      const init: RequestInit = { method: request.method, headers };
      if (request.method !== "GET" && request.method !== "HEAD") {
        init.body = JSON.stringify(authPayload);
      }

      const response = await auth.handler(new Request(url.toString(), init));
      reply.status(response.status);
      applyResponseHeaders(reply, response.headers);

      const responseText = response.body ? await response.text() : "";
      let responseJson: unknown = null;
      if (responseText) {
        try {
          responseJson = JSON.parse(responseText);
        } catch {
          responseJson = null;
        }
      }

      if (response.ok && responseJson && typeof responseJson === "object") {
        const payload = responseJson as { user?: { id?: string; name?: string; email?: string } };
        const userId = payload.user?.id;
        if (userId) {
          try {
            await upsertReferralLink({
              userId,
              sponsorId: sponsor?.id ?? null,
            });
            if (sponsor && sponsor.membershipStatus === "inactive") {
              try {
                await sendInactiveSponsorReferralNotice({
                  sponsor,
                  referred: {
                    id: userId,
                    name: payload.user?.name ?? null,
                    email: payload.user?.email ?? "",
                    username: typeof authPayload.username === "string" ? authPayload.username : null,
                  },
                });
              } catch (error) {
                request.log.error({ err: error }, "Failed to send inactive sponsor referral email");
              }
            }
          } catch (error) {
            request.log.error({ err: error }, "Failed to link referral after sign up");
          }
        }
      }

      if (responseJson !== null) {
        return reply.send(responseJson);
      }
      return reply.send(responseText || null);
    })
  );
  app.post(
    "/api/auth/change-email-otp",
    {
      schema: {
        tags: ["Auth"],
        summary: "Send OTP code for email change",
        body: {
          type: "object",
          required: ["newEmail"],
          properties: {
            newEmail: { type: "string", format: "email" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              message: { type: "string" },
            },
          },
        },
      },
    },
    asyncHandler(async (request, reply) => {
      const session = await auth.api.getSession({
        headers: request.headers as Record<string, string>,
      });
      if (!session?.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const { newEmail } = request.body as { newEmail: string };
      const identifier = `change-email:${session.user.id}:${newEmail}`;
      const now = new Date();
      const resendAfter = new Date(Date.now() - OTP_RESEND_COOLDOWN_SECONDS * 1000);
      const recentOtp = await db
        .select()
        .from(schema.verification)
        .where(
          and(
            eq(schema.verification.identifier, identifier),
            gt(schema.verification.expiresAt, now),
            gt(schema.verification.updatedAt, resendAfter)
          )
        )
        .limit(1);
      if (recentOtp.length > 0) {
        return reply.status(429).send({
          error: "Ya enviamos un codigo. Espera un momento antes de reintentar.",
        });
      }
      const otpCode = await generateChangeEmailOTP(session.user.id, newEmail);
      try {
        await emailHandlers.sendChangeEmailOTP({
          user: { email: session.user.email, name: session.user.name },
          newEmail,
          otpCode,
        });
      } catch (error) {
        request.log.error({ err: error }, "Failed to send change email OTP");
        return reply.status(502).send({
          error: "No pudimos enviar el codigo. Intenta de nuevo mas tarde.",
        });
      }
      reply.send({ message: "OTP code sent successfully" });
    })
  );

  app.post(
    "/api/auth/two-factor/disable",
    {
      schema: {
        tags: ["Auth"],
        summary: "Disable two-factor authentication (requires TOTP code)",
        body: {
          type: "object",
          required: ["password", "code"],
          properties: {
            password: { type: "string" },
            code: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              message: { type: "string" },
            },
          },
        },
      },
    },
    asyncHandler(async (request, reply) => {
      const session = await auth.api.getSession({
        headers: request.headers as Record<string, string>,
      });
      if (!session?.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const { password, code } = request.body as { password: string; code: string };
      if (!code || code.trim().length !== 6) {
        return reply.status(400).send({ error: "Invalid code" });
      }
      try {
        await auth.api.verifyTOTP({
          headers: request.headers as Record<string, string>,
          body: { code: code.trim() },
        });
      } catch (error: unknown) {
        const err = error as { statusCode?: number; status?: number; message?: string };
        const status = err?.statusCode || err?.status || 400;
        return reply.status(status).send({ error: err?.message || "Invalid code" });
      }
      let disableResponse;
      try {
        disableResponse = await auth.api.disableTwoFactor({
          headers: request.headers as Record<string, string>,
          body: { password },
          returnHeaders: true,
        });
      } catch (error: unknown) {
        const err = error as { statusCode?: number; status?: number; message?: string };
        const status = err?.statusCode || err?.status || 400;
        return reply.status(status).send({
          error: err?.message || "Failed to disable two-factor authentication",
        });
      }
      applyAuthHeaders(reply, disableResponse?.headers || null);
      reply.send({ message: "Two-factor authentication disabled" });
    })
  );

  app.post(
    "/api/auth/verify-change-email-otp",
    {
      schema: {
        tags: ["Auth"],
        summary: "Verify OTP code and change email",
        body: {
          type: "object",
          required: ["newEmail", "otpCode"],
          properties: {
            newEmail: { type: "string", format: "email" },
            otpCode: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              message: { type: "string" },
            },
          },
        },
      },
    },
    asyncHandler(async (request, reply) => {
      const session = await auth.api.getSession({
        headers: request.headers as Record<string, string>,
      });
      if (!session?.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const { newEmail, otpCode } = request.body as { newEmail: string; otpCode: string };
      const isValid = await verifyChangeEmailOTP(session.user.id, newEmail, otpCode);
      if (!isValid) {
        return reply.status(400).send({ error: "Invalid or expired OTP code" });
      }
      await db
        .update(schema.user)
        .set({ email: newEmail, emailVerified: true, updatedAt: new Date() })
        .where(eq(schema.user.id, session.user.id));
      const sessionUpdate = await auth.api.updateUser({
        headers: request.headers as Record<string, string>,
        body: { name: session.user.name },
        returnHeaders: true,
      });
      if (sessionUpdate?.headers) {
        applyAuthHeaders(reply, sessionUpdate.headers);
      }
      reply.send({ message: "Email changed successfully" });
    })
  );

  app.get(
    "/api/auth/api-docs/openapi.json",
    {
      schema: {
        tags: ["System"],
        summary: "Better Auth OpenAPI schema",
        response: {
          200: {
            type: "object",
            additionalProperties: true,
          },
        },
      },
    },
    asyncHandler(async (request, reply) => {
      const schema = await auth.api.generateOpenAPISchema();
      if (!schema) {
        throw new InternalServerError("OpenAPI schema unavailable");
      }
      reply.type("application/json").send(schema);
    })
  );

  app.get(
    "/api/auth/list-sessions",
    {
      schema: {
        tags: ["Auth"],
        summary: "List all active sessions for the current user",
        operationId: "getListSessions",
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                token: { type: "string" },
                expiresAt: { type: "string", format: "date-time" },
                createdAt: { type: "string", format: "date-time" },
                updatedAt: { type: "string", format: "date-time" },
                ipAddress: { type: "string" },
                userAgent: { type: "string" },
                userId: { type: "string" },
              },
            },
          },
        },
      },
    },
    asyncHandler(async (request, reply) => {
      const session = await auth.api.getSession({
        headers: request.headers as Record<string, string>,
      });
      if (!session?.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const sessions = await db
        .select()
        .from(schema.session)
        .where(
          and(
            eq(schema.session.userId, session.user.id),
            gt(schema.session.expiresAt, new Date())
          )
        )
        .orderBy(schema.session.updatedAt);
      return reply.send(sessions);
    }),
  );

  app.route({
    method: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    url: "/api/auth/*",
    schema: { hide: true },
    handler: asyncHandler(async (request, reply) => {
      const protocol =
        request.headers["x-forwarded-proto"] ||
        ((request.server as { https?: boolean }).https ? "https" : "http");
      const host = request.headers.host || "localhost";
      const url = new URL(request.url, `${protocol}://${host}`);
      const headers = buildFetchHeaders(request);
      const init = buildRequestInit(request, headers);
      const response = await auth.handler(new Request(url.toString(), init));
      reply.status(response.status);
      applyResponseHeaders(reply, response.headers);
      reply.send(response.body ? await response.text() : null);
    }),
  });
}
