import { db } from "../../config/db";
import { schema, eq, and, gt } from "@nexxatrade/db";
import crypto from "crypto";

const OTP_EXPIRY_MINUTES = 10;
const OTP_LENGTH = 6;

export async function generateChangeEmailOTP(
  userId: string,
  newEmail: string
): Promise<string> {
  const otpCode = crypto
    .randomInt(0, Math.pow(10, OTP_LENGTH))
    .toString()
    .padStart(OTP_LENGTH, "0");

  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

  const identifier = `change-email:${userId}:${newEmail}`;

  const existing = await db
    .select()
    .from(schema.verification)
    .where(eq(schema.verification.identifier, identifier))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(schema.verification)
      .set({
        value: otpCode,
        expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(schema.verification.identifier, identifier));
  } else {
    await db.insert(schema.verification).values({
      id: crypto.randomUUID(),
      identifier,
      value: otpCode,
      expiresAt,
    });
  }

  return otpCode;
}

export async function verifyChangeEmailOTP(
  userId: string,
  newEmail: string,
  otpCode: string
): Promise<boolean> {
  const identifier = `change-email:${userId}:${newEmail}`;

  const result = await db
    .select()
    .from(schema.verification)
    .where(
      and(
        eq(schema.verification.identifier, identifier),
        eq(schema.verification.value, otpCode),
        gt(schema.verification.expiresAt, new Date())
      )
    )
    .limit(1);

  if (result.length === 0) {
    return false;
  }

  await db
    .delete(schema.verification)
    .where(eq(schema.verification.identifier, identifier));

  return true;
}
