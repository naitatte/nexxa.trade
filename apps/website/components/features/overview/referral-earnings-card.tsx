"use client"

import { useMemo } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useWalletSummary, useWalletTransactions } from "@/lib/api/wallet/client"
import { Spinner } from "@/components/ui/spinner"
import { TrendingUp, ChevronRight } from "lucide-react"

function formatUsd(cents?: number): string {
  if (typeof cents !== "number") return "—"
  return `$${(cents / 100).toFixed(2)}`
}

export function ReferralEarningsCard() {
  const { data: summary, isLoading: summaryLoading } = useWalletSummary()
  const { data: transactionsData, isLoading: txLoading } = useWalletTransactions()

  const { week, month, allTime } = useMemo(() => {
    const deposits = (transactionsData?.items ?? []).filter((t) => t.type === "deposit")
    const now = new Date()

    const weekAgo = new Date(now)
    weekAgo.setDate(weekAgo.getDate() - 7)
    const monthAgo = new Date(now)
    monthAgo.setDate(monthAgo.getDate() - 30)

    let weekCents = 0
    let monthCents = 0

    for (const d of deposits) {
      const date = new Date(d.createdAt)
      if (date >= weekAgo) weekCents += d.amountUsdCents
      if (date >= monthAgo) monthCents += d.amountUsdCents
    }

    return {
      week: weekCents,
      month: monthCents,
      allTime: summary?.lifetimeEarnedUsdCents ?? 0,
    }
  }, [transactionsData?.items, summary?.lifetimeEarnedUsdCents])

  const isLoading = summaryLoading || txLoading

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b pb-6">
        <div className="space-y-1.5">
          <CardTitle className="text-sm font-medium">Referral earnings</CardTitle>
          <CardDescription>Commissions from your referrals by period</CardDescription>
        </div>
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <div className="space-y-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last 7 days</span>
              <span className="font-medium tabular-nums">
                {isLoading ? <Spinner className="size-4" /> : formatUsd(week)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last 30 days</span>
              <span className="font-medium tabular-nums">
                {isLoading ? <Spinner className="size-4" /> : formatUsd(month)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">All time</span>
              <span className="font-medium tabular-nums">
                {isLoading ? <Spinner className="size-4" /> : formatUsd(allTime)}
              </span>
            </div>
          </div>
        </div>
        <Link
          href="/wallet"
          className="mt-auto flex items-center gap-1 pt-4 text-sm font-medium text-primary hover:underline"
        >
          View wallet
          <ChevronRight className="h-4 w-4" />
        </Link>
      </CardContent>
    </Card>
  )
}
