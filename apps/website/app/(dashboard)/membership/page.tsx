import { redirect } from "next/navigation"
import { DashboardBreadcrumb } from "@/components/features/dashboard/breadcrumb/dashboard-breadcrumb"
import { SubscriptionStatusBadge } from "@/components/features/membership/status/subscription-status-badge"
import { MembershipContent } from "@/components/features/membership/membership-content"
import { auth } from "@/lib/auth/server"
import { getApiBaseUrl } from "@/lib/api/base-url"
import { getRequestHeaders } from "@/lib/auth/request-headers"

type MembershipStatus = "active" | "inactive" | "deleted"
type MembershipTier = string

type PlanData = {
  tier: string
  name: string
  description?: string | null
  priceUsdCents: number
  durationDays?: number | null
  isActive?: boolean
  sortOrder?: number
}

type MembershipData = {
  status: MembershipStatus
  tier: MembershipTier | null
  expiresAt: Date | null
  inactiveAt: Date | null
  deletionAt: Date | null
  deletionDays: number | null
  activatedAt: Date | null
}

type MembershipInvoice = {
  id: string
  tier: string
  status: string
  sweepStatus: string | null
  amountUsdCents: number
  chain: string | null
  txHash: string | null
  depositAddress: string | null
  createdAt: string
  confirmedAt: string | null
  appliedAt: string | null
}

type InvoiceResponse = {
  page: number
  pageSize: number
  total: number
  items: MembershipInvoice[]
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

async function getPlanData(cookieHeader: string | null): Promise<PlanData[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/membership/tiers`, {
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

async function getInvoiceData(cookieHeader: string | null): Promise<InvoiceResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/payments/invoices?page=1&pageSize=100`, {
      headers: {
        "Content-Type": "application/json",
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      credentials: "include",
      cache: "no-store",
    })

    if (!response.ok) {
      return { page: 1, pageSize: 0, total: 0, items: [] }
    }

    const data = await response.json()
    return {
      page: typeof data.page === "number" ? data.page : 1,
      pageSize: typeof data.pageSize === "number" ? data.pageSize : 0,
      total: typeof data.total === "number" ? data.total : 0,
      items: Array.isArray(data.items) ? data.items : [],
    }
  } catch {
    return { page: 1, pageSize: 0, total: 0, items: [] }
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
  const plans = await getPlanData(cookieHeader)
  const invoices = await getInvoiceData(cookieHeader)

  const status: MembershipStatus = membership?.status || "inactive"
  const tier = membership?.tier || null
  const currentPlan: PlanData | null = tier
    ? (plans.find((plan) => plan.tier === tier) ?? null)
    : null
  const membershipDates = membership
    ? {
        expiresAt: membership.expiresAt?.toISOString() ?? null,
        inactiveAt: membership.inactiveAt?.toISOString() ?? null,
        deletionAt: membership.deletionAt?.toISOString() ?? null,
        deletionDays: membership.deletionDays ?? null,
        activatedAt: membership.activatedAt?.toISOString() ?? null,
      }
    : null

  return (
    <>
      <DashboardBreadcrumb />
      <div className="flex flex-1 flex-col gap-6 p-6 lg:p-8">
        
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Membership</h1>
            <p className="text-sm text-muted-foreground">Manage your plan and billing.</p>
          </div>
          <SubscriptionStatusBadge status={status} />
        </header>

        <MembershipContent
          status={status}
          tier={tier}
          currentPlan={currentPlan}
          membershipDates={membershipDates}
          invoices={invoices}
        />
      </div>
    </>
  )
}
