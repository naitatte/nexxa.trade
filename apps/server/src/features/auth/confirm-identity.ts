import type { Session } from "./auth";
import { auth } from "./auth";

export type ConfirmIdentityInput = {
  session: Session;
  password: string;
  code?: string;
  headers: Record<string, string>;
};

export class IdentityConfirmationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 401
  ) {
    super(message);
    this.name = "IdentityConfirmationError";
  }
}

export async function confirmIdentity(input: ConfirmIdentityInput): Promise<void> {
  const { session, password, code, headers } = input;
  if (!password?.trim()) {
    throw new IdentityConfirmationError("Password is required", 400);
  }
  const twoFactorEnabled = (session.user as { twoFactorEnabled?: boolean }).twoFactorEnabled === true;
  if (twoFactorEnabled) {
    if (!code?.trim() || code.trim().length !== 6) {
      throw new IdentityConfirmationError("Authentication code is required", 400);
    }
    try {
      await auth.api.verifyTOTP({
        headers,
        body: { code: code.trim() },
      });
    } catch {
      throw new IdentityConfirmationError("Invalid code", 400);
    }
  }
  const userEmail = session.user.email;
  if (!userEmail) {
    throw new IdentityConfirmationError("Email not found", 400);
  }
  try {
    await auth.api.signInEmail({
      headers,
      body: {
        email: userEmail,
        password: password.trim(),
      },
    });
  } catch {
    throw new IdentityConfirmationError("Invalid password", 401);
  }
}
