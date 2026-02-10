"use client"

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useGetApiReferralsStats } from "@/lib/api/referrals/referrals"
import { Spinner } from "@/components/ui/spinner"
import { Network, ChevronRight } from "lucide-react"

export function NetworkStatsCard() {
  const { data: stats, isLoading, isError } = useGetApiReferralsStats({
    query: { staleTime: 60_000 },
  })

  const showSpinner = isLoading
  const showPlaceholder = isError
  const total = stats?.totalTeam ?? 0
  const active = stats?.activeMembers ?? 0
  const inactive = total - active
  const atRisk = stats?.atRiskMembers ?? 0

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b pb-6">
        <div className="space-y-1.5">
          <CardTitle className="text-sm font-medium">Network</CardTitle>
          <CardDescription>Your referral team overview</CardDescription>
        </div>
        <Network className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <div className="space-y-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total referrals</span>
              <span className="font-medium tabular-nums">
                {showSpinner ? <Spinner className="size-4" /> : showPlaceholder ? "—" : total}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Active</span>
              <span className="font-medium tabular-nums">
                {showSpinner ? <Spinner className="size-4" /> : showPlaceholder ? "—" : active}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Inactive</span>
              <span className="font-medium tabular-nums">
                {showSpinner ? <Spinner className="size-4" /> : showPlaceholder ? "—" : inactive}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">At risk</span>
              <span className="font-medium tabular-nums">
                {showSpinner ? <Spinner className="size-4" /> : showPlaceholder ? "—" : atRisk}
              </span>
            </div>
          </div>
        </div>
        <Link
          href="/network/data"
          className="mt-auto flex items-center gap-1 pt-4 text-sm font-medium text-primary hover:underline"
        >
          View network
          <ChevronRight className="h-4 w-4" />
        </Link>
      </CardContent>
    </Card>
  )
}
