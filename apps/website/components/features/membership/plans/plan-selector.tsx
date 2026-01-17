"use client"

import { PlanCard } from "./plan-card"

type PlanTier = "trial_weekly" | "annual" | "lifetime"

type PlanSelectorProps = {
  currentTier?: PlanTier | null
  isActive?: boolean
  showOnlyUpgrades?: boolean
}

const allTiers: PlanTier[] = ["trial_weekly", "annual", "lifetime"]
const tierOrder: Record<PlanTier, number> = { trial_weekly: 1, annual: 2, lifetime: 3 }

function handleSelectPlan(tier: PlanTier) {
  window.location.href = `/dashboard/checkout?plan=${tier}`
}

export function PlanSelector({ currentTier, isActive, showOnlyUpgrades }: PlanSelectorProps) {
  let tiers = allTiers

  if (showOnlyUpgrades && currentTier) {
    const currentOrder = tierOrder[currentTier]
    tiers = allTiers.filter((tier) => tierOrder[tier] > currentOrder)
  }

  if (tiers.length === 0) return null

  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {tiers.map((tier) => (
        <PlanCard
          key={tier}
          tier={tier}
          currentTier={currentTier}
          isActive={isActive}
          onSelect={() => handleSelectPlan(tier)}
        />
      ))}
    </div>
  )
}
