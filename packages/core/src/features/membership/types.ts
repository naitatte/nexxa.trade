import type { MEMBERSHIP_STATUS_LIST } from "./constants";

export type MembershipTier = string;
export type MembershipStatus = (typeof MEMBERSHIP_STATUS_LIST)[number];

export type MembershipPaymentStatus = "pending" | "confirmed" | "failed";

export type CommissionSplit = {
  totalPoolCents: number;
  sponsorAmountCents: number;
  levelAmountCents: number;
};
