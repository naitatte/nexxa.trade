"use client"

import { useMemo, useState } from "react"
import { Spinner } from "@/components/ui/spinner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useGetApiMembershipTiers } from "@/lib/api/membership/membership"
import { CheckoutFlow } from "@/components/features/payments/checkout/checkout-flow"
import { PlanCard } from "./plan-card"

type PlanSelectorProps = {
  currentTier: string | null
  isActive: boolean
  showOnlyUpgrades?: boolean
}

type TierData = {
  tier: string
  name: string
  description?: string | null
  priceUsdCents: number
  durationDays?: number | null
  isActive?: boolean
  sortOrder?: number
}

const isUpgrade = (current: TierData | null, next: TierData) => {
  if (!current) return true
  const currentOrder = current.sortOrder ?? 0
  const nextOrder = next.sortOrder ?? 0
  return nextOrder > currentOrder
}

export function PlanSelector({ currentTier, isActive, showOnlyUpgrades = false }: PlanSelectorProps) {
  const { data, isLoading } = useGetApiMembershipTiers({
    query: {
      staleTime: 60_000,
    },
  })

  const tiers = useMemo(() => {
    const apiTiers = data?.tiers ?? []
    const normalized = apiTiers
      .map((tier) => ({
        tier: String(tier.tier),
        name: tier.name ?? String(tier.tier),
        description: tier.description ?? null,
        priceUsdCents: tier.priceUsdCents,
        durationDays: tier.durationDays ?? null,
        isActive: tier.isActive ?? true,
        sortOrder: tier.sortOrder ?? 0,
      }))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

    const activePlans = normalized.filter((tier) => tier.isActive !== false)

    if (showOnlyUpgrades) {
      const currentPlan = normalized.find((tier) => tier.tier === currentTier) ?? null
      return activePlans.filter((tier) => isUpgrade(currentPlan, tier))
    }

    return activePlans
  }, [currentTier, data?.tiers, showOnlyUpgrades])

  const [selectedTier, setSelectedTier] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const handleOpenCheckout = (tier: string) => {
    setSelectedTier(tier)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-4">
      {isLoading && !tiers.length ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="size-4" />
          Loading plans...
        </div>
      ) : tiers.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiers.map((tier) => {
            const isCurrent = isActive && currentTier === tier.tier

            return (
              <PlanCard
                key={tier.tier}
                tier={tier.tier}
                name={tier.name}
                description={tier.description ?? undefined}
                priceUsdCents={tier.priceUsdCents}
                durationDays={tier.durationDays ?? null}
                isCurrent={isCurrent}
                onClick={() => !isCurrent && handleOpenCheckout(tier.tier)}
                className="w-full"
              />
            )
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No plans available right now.</p>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Complete your payment</DialogTitle>
            <DialogDescription>
              Review your selected plan and proceed to payment.
            </DialogDescription>
          </DialogHeader>
          {selectedTier && (() => {
            const tierData = tiers.find((t) => t.tier === selectedTier)
            if (!tierData) return null
            return (
              <CheckoutFlow
                key={selectedTier}
                tier={selectedTier}
                planName={tierData.name}
                priceUsdCents={tierData.priceUsdCents}
                durationDays={tierData.durationDays ?? null}
                onReset={() => setDialogOpen(false)}
              />
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}
