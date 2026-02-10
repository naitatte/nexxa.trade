import { redirect } from "next/navigation"
import { DashboardBreadcrumb } from "@/components/features/dashboard/breadcrumb/dashboard-breadcrumb"
import { DashboardOverviewCards } from "@/components/features/overview/dashboard-overview-cards"
import { auth } from "@/lib/auth/server"
import { getApiBaseUrl } from "@/lib/api/base-url"
import { getRequestHeaders } from "@/lib/auth/request-headers"

type MembershipStatus = "active" | "inactive" | "deleted"

type PlanData = {
  tier: string
  name: string
  priceUsdCents: number
  durationDays?: number | null
}

type MembershipData = {
  status: MembershipStatus
  tier: string | null
  expiresAt: Date | null
  activatedAt: Date | null
}

async function getMembershipData(
  userId: string,
  cookieHeader: string | null
): Promise<MembershipData | null> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/membership/users/${userId}`, {
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
      tier: data.tier ?? null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      activatedAt: data.activatedAt ? new Date(data.activatedAt) : null,
    }
  } catch {
    return null
  }
}

async function getPlanData(cookieHeader: string | null): Promise<PlanData[]> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/membership/tiers`, {
      headers: {
        "Content-Type": "application/json",
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      credentials: "include",
      cache: "no-store",
    })
    if (!response.ok) return []
    const data = await response.json()
    return Array.isArray(data?.tiers) ? data.tiers : []
  } catch {
    return []
  }
}

export default async function Page() {
  const headersList = await getRequestHeaders()
  const cookieHeader = headersList.get("cookie")
  const session = await auth.api.getSession({
    headers: headersList as unknown as Headers,
  })
  if (!session) redirect("/login")

  const [membership, plans] = await Promise.all([
    getMembershipData(session.user.id, cookieHeader),
    getPlanData(cookieHeader),
  ])

  const status: MembershipStatus = membership?.status ?? "inactive"
  const tier = membership?.tier ?? null
  const currentPlan = tier ? (plans.find((p) => p.tier === tier) ?? null) : null

  return (
    <>
      <DashboardBreadcrumb />
      <div className="flex flex-1 flex-col gap-6 p-6 lg:p-8">
        <DashboardOverviewCards
          membershipStatus={status}
          planName={currentPlan?.name}
          tier={tier}
          expiresAt={membership?.expiresAt ?? null}
          activatedAt={membership?.activatedAt ?? null}
          durationDays={currentPlan?.durationDays ?? null}
          username={session.user.username ?? null}
          email={session.user.email}
        />
      </div>
    </>
  )
}
