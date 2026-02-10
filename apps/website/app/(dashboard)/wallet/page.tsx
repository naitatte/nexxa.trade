import { DashboardBreadcrumb } from "@/components/features/dashboard/breadcrumb/dashboard-breadcrumb"
import { WalletContent } from "@/components/features/wallet/wallet-content"
import { WalletHeaderActions } from "@/components/features/wallet/wallet-header-actions"
import { requireActiveMembershipOrAdmin } from "@/lib/auth/server-guards"
import { generatePageMetadata } from "@/lib/metadata"

export const metadata = generatePageMetadata({
  title: "Wallet",
  description: "Manage your wallet and withdrawal requests.",
  url: "/wallet",
})

export default async function WalletPage() {
  await requireActiveMembershipOrAdmin()

  return (
    <>
      <DashboardBreadcrumb />
      <div className="flex flex-1 flex-col gap-6 p-6 lg:p-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Wallet</h1>
            <p className="text-sm text-muted-foreground">Manage your wallet and withdrawal requests.</p>
          </div>
          <WalletHeaderActions />
        </header>

        <WalletContent />
      </div>
    </>
  )
}
