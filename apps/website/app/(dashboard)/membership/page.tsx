import { redirect } from "next/navigation"
import { DashboardBreadcrumb } from "@/components/features/dashboard/breadcrumb/dashboard-breadcrumb"
import { SubscriptionStatusBadge } from "@/components/features/membership/membership/subscription-status-badge"
import { MembershipAlert } from "@/components/features/membership/membership/membership-alert"
import { MembershipInfo } from "@/components/features/membership/membership/membership-info"
import { PlanSelector } from "@/components/features/membership/plans/plan-selector"
import { UpgradePrompt } from "@/components/features/membership/plans/upgrade-prompt"
import { auth } from "@/lib/auth/server"
import { getApiBaseUrl } from "@/lib/api/base-url"
import { getRequestHeaders } from "@/lib/auth/request-headers"

type MembershipStatus = "active" | "inactive" | "deleted"
type MembershipTier = "trial_weekly" | "annual" | "lifetime"

type MembershipData = {
  status: MembershipStatus
  tier: MembershipTier | null
  expiresAt: Date | null
  inactiveAt: Date | null
  deletionAt: Date | null
  deletionDays: number | null
  activatedAt: Date | null
}

const API_BASE_URL = getApiBaseUrl()

async function getMembershipData(userId: string, cookieHeader: string | null): Promise<MembershipData | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/membership/users/${userId}`, {
      headers: {
        "Content-Type": "application/json",
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      credentials: "include",
      cache: "no-store",
    })

    if (!response.ok) return null

    const data = await response.json()

    return {
      status: (data.status as MembershipStatus) || "inactive",
      tier: (data.tier as MembershipTier) || null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      inactiveAt: data.inactiveAt ? new Date(data.inactiveAt) : null,
      deletionAt: data.deletionAt ? new Date(data.deletionAt) : null,
      deletionDays: typeof data.deletionDays === "number" ? data.deletionDays : null,
      activatedAt: data.activatedAt ? new Date(data.activatedAt) : null,
    }
  } catch {
    return null
  }
}

export default async function MembershipPage() {
  const headersList = await getRequestHeaders()
  const cookieHeader = headersList.get("cookie")
  
  const session = await auth.api.getSession({
    headers: headersList as unknown as Headers,
  })

  if (!session) redirect("/login")

  const membership = await getMembershipData(session.user.id, cookieHeader)

  const status: MembershipStatus = membership?.status || "inactive"
  const tier = membership?.tier || null
  const isLifetime = tier === "lifetime"
  const isActive = status === "active"
  const isInactive = status === "inactive"
  const showDeletionAlert = isInactive && Boolean(membership?.inactiveAt)

  return (
    <>
      <DashboardBreadcrumb />
      <div className="flex flex-1 flex-col gap-8 p-6 lg:p-8">
        
        <header className="flex items-center justify-between border-b pb-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Membership</h1>
            <p className="text-sm text-muted-foreground">Manage your plan and billing.</p>
          </div>
          <SubscriptionStatusBadge status={status} />
        </header>

        {showDeletionAlert && (
          <MembershipAlert
            inactiveAt={membership?.inactiveAt || null}
            deletionAt={membership?.deletionAt || null}
            deletionDays={membership?.deletionDays ?? 7}
          />
        )}

        {isActive && tier && (
           <div className="space-y-6">
              <MembershipInfo
                tier={tier}
                expiresAt={membership?.expiresAt || null}
                activatedAt={membership?.activatedAt || null}
              />
              
              {!isLifetime && (
                 <div className="space-y-2">
                    <h3 className="text-sm font-medium">Upgrade plan</h3>
                    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                      <UpgradePrompt currentTier={tier} />
                    </div>
                 </div>
              )}
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
      </div>
    </>
  )
}
