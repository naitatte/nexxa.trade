import { redirect } from "next/navigation"
import { DashboardBreadcrumb } from "@/components/features/dashboard/breadcrumb/dashboard-breadcrumb"
import { ReferralsContent } from "@/components/features/referrals/referrals-content"
import { Separator } from "@/components/ui/separator"
import { auth } from "@/lib/auth/server"
import { getApiBaseUrl } from "@/lib/api/base-url"
import { getRequestHeaders } from "@/lib/auth/request-headers"
import { requireActiveMembershipOrAdmin } from "@/lib/auth/server-guards"

type ReferralStats = {
  directPartners: number
  totalTeam: number
  activeMembers: number
  atRiskMembers: number
}

type ReferralTeamMember = {
  id: string
  name: string
  username: string | null
  email: string
  membershipStatus: string
  joinedAt: string
  level: number
}

type TeamResponse = {
  items: ReferralTeamMember[]
  total: number
  page: number
  pageSize: number
}

const API_BASE_URL = getApiBaseUrl()

async function getReferralStats(cookieHeader: string | null): Promise<ReferralStats> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/referrals/stats`, {
      headers: {
        "Content-Type": "application/json",
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      credentials: "include",
      cache: "no-store",
    })
    if (!response.ok) return { directPartners: 0, totalTeam: 0, activeMembers: 0, atRiskMembers: 0 }
    return await response.json()
  } catch {
    return { directPartners: 0, totalTeam: 0, activeMembers: 0, atRiskMembers: 0 }
  }
}

async function getReferralTeam(cookieHeader: string | null, status?: string): Promise<TeamResponse> {
  try {
    const params = new URLSearchParams({ page: "1", pageSize: "100" })
    if (status) params.set("status", status)
    const response = await fetch(`${API_BASE_URL}/api/referrals/team?${params.toString()}`, {
      headers: {
        "Content-Type": "application/json",
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      credentials: "include",
      cache: "no-store",
    })
    if (!response.ok) return { items: [], total: 0, page: 1, pageSize: 100 }
    return await response.json()
  } catch {
    return { items: [], total: 0, page: 1, pageSize: 100 }
  }
}

export default async function ReferralsPage() {
  await requireActiveMembershipOrAdmin()

  const headersList = await getRequestHeaders()
  const cookieHeader = headersList.get("cookie")

  const session = await auth.api.getSession({
    headers: headersList as unknown as Headers,
  })

  if (!session) redirect("/login")

  const [stats, team, atRiskTeam] = await Promise.all([
    getReferralStats(cookieHeader),
    getReferralTeam(cookieHeader),
    getReferralTeam(cookieHeader, "at_risk"),
  ])

  const user = {
    id: session.user.id,
    name: session.user.name,
    username: session.user.username ?? null,
    email: session.user.email,
  }

  return (
    <>
      <DashboardBreadcrumb />
      <div className="flex flex-1 flex-col gap-6 p-6 lg:p-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Referrals</h1>
            <p className="text-sm text-muted-foreground">Share your referral code and grow your team.</p>
          </div>
        </header>

        <Separator />

        <ReferralsContent
          user={user}
          stats={stats}
          team={{ items: team.items, total: team.total }}
          atRiskTeam={{ items: atRiskTeam.items, total: atRiskTeam.total }}
        />
      </div>
    </>
  )
}
