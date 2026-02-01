"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTabsStore } from "@/lib/stores/ui/tabs-store"
import { MembershipAlert } from "@/components/features/membership/status/membership-alert"
import { MembershipInfo } from "@/components/features/membership/status/membership-info"
import { PlanSelector } from "@/components/features/membership/plans/plan-selector"
import { MembershipInvoicesSection } from "@/components/features/membership/invoices/membership-invoices-section"
import type { MembershipInvoice } from "@/components/features/membership/invoices/membership-invoices-table"

type PlanData = {
  tier: string
  name: string
  description?: string | null
  priceUsdCents: number
  durationDays?: number | null
  isActive?: boolean
  sortOrder?: number
}

type MembershipDates = {
  expiresAt: string | null
  inactiveAt: string | null
  deletionAt: string | null
  deletionDays: number | null
  activatedAt: string | null
}

type MembershipContentProps = {
  status: "active" | "inactive" | "deleted"
  tier: string | null
  currentPlan: PlanData | null
  membershipDates: MembershipDates | null
  invoices: {
    items: MembershipInvoice[]
    total: number
  }
}

const toDate = (value: string | null) => (value ? new Date(value) : null)

export function MembershipContent({
  status,
  tier,
  currentPlan,
  membershipDates,
  invoices,
}: MembershipContentProps) {
  const activeTab = useTabsStore((state) => state.activeTabs.membership ?? "overview")
  const setActiveTab = useTabsStore((state) => state.setActiveTab)
  const isActive = status === "active"
  const isInactive = status === "inactive"
  const isLifetime =
    (currentPlan?.tier ?? tier) === "lifetime" ||
    ((currentPlan?.durationDays ?? 0) >= 3650)
  const showDeletionAlert = isInactive && Boolean(membershipDates?.inactiveAt)

  const inactiveAt = toDate(membershipDates?.inactiveAt ?? null)
  const deletionAt = toDate(membershipDates?.deletionAt ?? null)
  const expiresAt = toDate(membershipDates?.expiresAt ?? null)
  const activatedAt = toDate(membershipDates?.activatedAt ?? null)

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab("membership", value)}
      className="w-full"
    >
      <TabsList variant="line" className="mb-6">
        <TabsTrigger variant="line" value="overview">Overview</TabsTrigger>
        <TabsTrigger variant="line" value="invoices">Invoices</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-6">
        {showDeletionAlert && (
          <MembershipAlert
            inactiveAt={inactiveAt}
            deletionAt={deletionAt}
            deletionDays={membershipDates?.deletionDays ?? 7}
          />
        )}

        {isActive && tier && (
          <div className="space-y-6">
            <MembershipInfo
              tier={tier}
              planName={currentPlan?.name}
              priceUsdCents={currentPlan?.priceUsdCents ?? null}
              durationDays={currentPlan?.durationDays ?? null}
              expiresAt={expiresAt}
              activatedAt={activatedAt}
            />
          </div>
        )}

        {(isInactive || (isActive && !isLifetime)) && (
          <section className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">
                {isActive ? "Change plan" : "Available plans"}
              </h2>
            </div>
            <PlanSelector
              currentTier={tier}
              isActive={isActive}
              showOnlyUpgrades={isActive}
            />
          </section>
        )}
      </TabsContent>

      <TabsContent value="invoices">
        <MembershipInvoicesSection invoices={invoices.items} total={invoices.total} />
      </TabsContent>
    </Tabs>
  )
}
