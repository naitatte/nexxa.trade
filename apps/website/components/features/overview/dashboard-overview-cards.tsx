"use client"

import { useUserPermissions } from "@/hooks/use-user-permissions"
import { MembershipDetailsCard } from "@/components/features/overview/membership-details-card"
import { WalletBalanceCard } from "@/components/features/overview/wallet-balance-card"
import { ReferralQuickCopyCard } from "@/components/features/overview/referral-quick-copy-card"
import { NetworkStatsCard } from "@/components/features/overview/network-stats-card"
import { ReferralEarningsCard } from "@/components/features/overview/referral-earnings-card"

type MembershipStatus = "active" | "inactive" | "deleted"

type DashboardOverviewCardsProps = {
  membershipStatus: MembershipStatus
  planName?: string | null
  tier?: string | null
  expiresAt?: Date | null
  activatedAt?: Date | null
  durationDays?: number | null
  username?: string | null
  email: string
}

export function DashboardOverviewCards({
  membershipStatus,
  planName,
  tier,
  expiresAt,
  activatedAt,
  durationDays,
  username,
  email,
}: DashboardOverviewCardsProps) {
  const permissions = useUserPermissions()

  const showWallet =
    permissions != null &&
    permissions.menuConfig.withdrawals != null &&
    !permissions.menuConfig.withdrawals.isDisabled

  const showNetwork =
    permissions != null &&
    permissions.menuConfig.network != null &&
    !permissions.menuConfig.network.isDisabled

  const cards = [
    <MembershipDetailsCard
      key="membership"
      status={membershipStatus}
      planName={planName}
      tier={tier}
      expiresAt={expiresAt}
      activatedAt={activatedAt}
      durationDays={durationDays}
    />,
    showWallet && <WalletBalanceCard key="wallet" />,
    showNetwork && (
      <ReferralQuickCopyCard
        key="referral"
        username={username ?? null}
        email={email}
      />
    ),
    showNetwork && <NetworkStatsCard key="network" />,
    showNetwork && <ReferralEarningsCard key="earnings" />,
  ].filter(Boolean)

  return (
    <div className="grid auto-rows-fr gap-4 md:grid-cols-2 lg:grid-cols-3">
      {cards}
    </div>
  )
}
