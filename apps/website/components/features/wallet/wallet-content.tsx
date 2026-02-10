"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTabsStore } from "@/lib/stores/ui/tabs-store"
import { Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { WalletTransactionsSection } from "./transactions/wallet-transactions-section"
import { WalletSavedWalletsSection } from "./saved-wallets/wallet-saved-wallets-section"
import { LoadingInline } from "@/lib/loading-state/components"
import { ErrorAlert } from "@/lib/error-state/components"
import { useWalletSummary, useWalletTransactions } from "@/lib/api/wallet/client"

const formatUsd = (cents?: number) => {
  if (typeof cents !== "number") return "—"
  return `$${(cents / 100).toFixed(2)}`
}

export function WalletContent() {
  const activeTab = useTabsStore((state) => state.activeTabs.wallet ?? "overview")
  const setActiveTab = useTabsStore((state) => state.setActiveTab)
  const { data: summary, isLoading: summaryLoading, isError: summaryError, error: summaryErrorObj, refetch: refetchSummary } = useWalletSummary()
  const { data: transactionsData, isLoading: txLoading, isError: txError, error: txErrorObj, refetch: refetchTx } = useWalletTransactions()
  const transactions = transactionsData?.items ?? []

  const hasError = summaryError || txError
  const errorMessage = summaryErrorObj ?? txErrorObj

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab("wallet", value)}
      className="w-full"
    >
      <TabsList variant="line" className="mb-6">
        <TabsTrigger variant="line" value="overview">Overview</TabsTrigger>
        <TabsTrigger variant="line" value="saved">Saved wallets</TabsTrigger>
        <TabsTrigger variant="line" value="history">Withdrawal history</TabsTrigger>
      </TabsList>

      {hasError && errorMessage && (
        <ErrorAlert
          error={errorMessage instanceof Error ? errorMessage : String(errorMessage)}
          onDismiss={() => {
            if (summaryError) refetchSummary()
            if (txError) refetchTx()
          }}
        />
      )}

      <TabsContent value="overview" className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Balance</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <LoadingInline isLoading message="Loading..." />
              ) : (
                <div className="text-2xl font-bold">
                  {formatUsd(summary?.availableUsdCents)}
                </div>
              )}
              <p className="text-xs text-muted-foreground">Available for withdrawal</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <ArrowDownRight className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <LoadingInline isLoading message="Loading..." />
              ) : (
                <div className="text-2xl font-bold">
                  {formatUsd(summary?.pendingUsdCents ?? summary?.reservedUsdCents)}
                </div>
              )}
              <p className="text-xs text-muted-foreground">Pending withdrawals</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total earned</CardTitle>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <LoadingInline isLoading message="Loading..." />
              ) : (
                <div className="text-2xl font-bold">
                  {formatUsd(summary?.lifetimeEarnedUsdCents)}
                </div>
              )}
              <p className="text-xs text-muted-foreground">All-time earnings</p>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="saved">
        <WalletSavedWalletsSection />
      </TabsContent>

      <TabsContent value="history">
        <WalletTransactionsSection transactions={transactions} isLoading={txLoading} />
      </TabsContent>
    </Tabs>
  )
}
