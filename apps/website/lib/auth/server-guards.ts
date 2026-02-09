import { redirect } from "next/navigation"
import { auth } from "@/lib/auth/server"
import { getRequestHeaders } from "@/lib/auth/request-headers"
import { getApiBaseUrl } from "@/lib/api/base-url"

type MembershipStatus = "active" | "inactive" | "deleted"

async function getMembershipData(userId: string, cookieHeader: string | null): Promise<{ status: string } | null> {
  try {
    const API_BASE_URL = getApiBaseUrl()
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
      status: data.status || "inactive",
    }
  } catch {
    return null
  }
}

export async function requireActiveMembershipOrAdmin(redirectTo: string = "/membership"): Promise<void> {
  const headersList = await getRequestHeaders()
  const cookieHeader = headersList.get("cookie")

  const session = await auth.api.getSession({
    headers: headersList as unknown as Headers,
  })

  if (!session) {
    redirect("/login")
  }

  const userRole = session.user.role?.toLowerCase()
  const isAdmin = userRole === "admin"

  if (isAdmin) {
    return
  }

  const membership = await getMembershipData(session.user.id, cookieHeader)
  const membershipStatus = membership?.status?.toLowerCase() || "inactive"
  const isActive = membershipStatus === "active"

  if (!isActive) {
    redirect(redirectTo)
  }
}

export async function requireRole(allowedRoles: string[], redirectTo: string = "/dashboard"): Promise<void> {
  const headersList = await getRequestHeaders()

  const session = await auth.api.getSession({
    headers: headersList as unknown as Headers,
  })

  if (!session) {
    redirect("/login")
  }

  const userRole = session.user.role?.toLowerCase() || "guest"
  const normalizedRoles = allowedRoles.map((role) => role.toLowerCase())

  if (!normalizedRoles.includes(userRole)) {
    redirect(redirectTo)
  }
}

export async function requireActiveMembership(redirectTo: string = "/membership"): Promise<void> {
  await requireActiveMembershipOrAdmin(redirectTo)
}
