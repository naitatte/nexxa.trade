"use client"

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SubscriptionStatusBadge } from "@/components/features/membership/status/subscription-status-badge"
import { ChevronRight } from "lucide-react"

type MembershipStatus = "active" | "inactive" | "deleted"

type MembershipDetailsCardProps = {
  status: MembershipStatus
  planName?: string | null
  tier?: string | null
  expiresAt?: Date | null
  activatedAt?: Date | null
  durationDays?: number | null
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return "—"
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date)
}

export function MembershipDetailsCard({
  status,
  planName,
  tier,
  expiresAt,
  activatedAt,
  durationDays,
}: MembershipDetailsCardProps) {
  const isLifetime =
    tier === "lifetime" ||
    (durationDays !== null && durationDays !== undefined && durationDays >= 3650)
  const displayName = planName || tier || "No plan"

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b pb-6">
        <div className="space-y-1.5">
          <CardTitle className="text-sm font-medium">Membership</CardTitle>
          <CardDescription>
            {status === "active" ? "Your plan and billing overview" : "Upgrade to access all features"}
          </CardDescription>
        </div>
        <SubscriptionStatusBadge status={status} />
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <div className="space-y-4">
          <div>
            <p className="text-2xl font-bold">{displayName}</p>
            <p className="text-xs text-muted-foreground">
              {status === "active" ? "Your current plan" : "Upgrade to access all features"}
            </p>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Expiration</span>
              <span className="font-medium">
                {isLifetime ? "Never" : formatDate(expiresAt)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Member since</span>
              <span className="font-medium">{formatDate(activatedAt)}</span>
            </div>
          </div>
        </div>
        <Link
          href="/membership"
          className="mt-auto flex items-center gap-1 pt-4 text-sm font-medium text-primary hover:underline"
        >
          Manage membership
          <ChevronRight className="h-4 w-4" />
        </Link>
      </CardContent>
    </Card>
  )
}
