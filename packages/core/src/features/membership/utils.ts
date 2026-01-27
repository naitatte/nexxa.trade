import { COMMISSION_RULES, MEMBERSHIP_TIERS } from "./constants";
import type { CommissionSplit, MembershipTier } from "./types";

export function calculateExpiresAt(
  tier: MembershipTier,
  activatedAt: Date
): Date | null {
  const tierConfig =
    tier in MEMBERSHIP_TIERS
      ? MEMBERSHIP_TIERS[tier as keyof typeof MEMBERSHIP_TIERS]
      : undefined;
  if (!tierConfig || tierConfig.durationDays === null) {
    return null;
  }

  const expiresAt = new Date(activatedAt);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + tierConfig.durationDays);
  return expiresAt;
}

export function calculateCommissionSplit(amountUsdCents: number): CommissionSplit {
  const totalPoolCents = Math.floor(amountUsdCents * 0.5);
  const sponsorAmountCents = Math.floor(
    amountUsdCents * COMMISSION_RULES.sponsorPct
  );
  const levelAmountCents = Math.floor(
    amountUsdCents * COMMISSION_RULES.uplinePct
  );

  const maxLevels = COMMISSION_RULES.maxUplineLevels;
  const maxDistributable = sponsorAmountCents + levelAmountCents * maxLevels;
  const remainder = totalPoolCents - maxDistributable;

  return {
    totalPoolCents,
    sponsorAmountCents: sponsorAmountCents + Math.max(remainder, 0),
    levelAmountCents,
  };
}
