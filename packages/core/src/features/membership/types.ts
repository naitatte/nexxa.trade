import type { MEMBERSHIP_STATUS_LIST, MEMBERSHIP_TIER_LIST } from "./constants";

export type MembershipTier = (typeof MEMBERSHIP_TIER_LIST)[number];
export type MembershipStatus = (typeof MEMBERSHIP_STATUS_LIST)[number];

export type MembershipPaymentStatus = "pending" | "confirmed" | "failed";

export type CommissionSplit = {
  totalPoolCents: number;
  sponsorAmountCents: number;
  levelAmountCents: number;
};
