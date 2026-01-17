export const MEMBERSHIP_TIERS = {
  trial_weekly: {
    priceUsdCents: 900,
    durationDays: 7,
  },
  annual: {
    priceUsdCents: 29900,
    durationDays: 365,
  },
  lifetime: {
    priceUsdCents: 49900,
    durationDays: null,
  },
} as const;

export const MEMBERSHIP_TIER_LIST = [
  "trial_weekly",
  "annual",
  "lifetime",
] as const;

export const MEMBERSHIP_STATUS_LIST = [
  "active",
  "inactive",
  "deleted",
] as const;

export const COMMISSION_RULES = {
  sponsorLevel: 1,
  sponsorPct: 0.2,
  uplinePct: 0.05,
  maxUplineLevels: 6,
} as const;
