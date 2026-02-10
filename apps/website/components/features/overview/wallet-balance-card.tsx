"use client"

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useWalletSummary } from "@/lib/api/wallet/client"
import { Spinner } from "@/components/ui/spinner"
import { Wallet, ChevronRight } from "lucide-react"

function formatUsd(cents?: number): string {
  if (typeof cents !== "number") return "—"
  return `$${(cents / 100).toFixed(2)}`
}

export function WalletBalanceCard() {
  const { data: summary, isLoading } = useWalletSummary()
  const availableCents = summary?.availableUsdCents
  const pendingCents = summary?.pendingUsdCents ?? summary?.reservedUsdCents

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b pb-6">
        <div className="space-y-1.5">
          <CardTitle className="text-sm font-medium">Wallet</CardTitle>
          <CardDescription>Your balance and withdrawal status</CardDescription>
        </div>
        <Wallet className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <div className="space-y-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Available to withdraw</span>
              <span className="font-medium">
                {isLoading ? <Spinner className="size-4" /> : formatUsd(availableCents)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pending (being withdrawn)</span>
              <span className="font-medium">
                {isLoading ? <Spinner className="size-4" /> : formatUsd(pendingCents)}
              </span>
            </div>
          </div>
        </div>
        <Link
          href="/wallet"
          className="mt-auto flex items-center gap-1 pt-4 text-sm font-medium text-primary hover:underline"
        >
          Withdraw funds
          <ChevronRight className="h-4 w-4" />
        </Link>
      </CardContent>
    </Card>
  )
}
