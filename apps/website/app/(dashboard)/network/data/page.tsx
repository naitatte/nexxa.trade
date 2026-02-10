import { DashboardBreadcrumb } from "@/components/features/dashboard/breadcrumb/dashboard-breadcrumb"
import { NetworkDataContent } from "@/components/features/network/data/network-data-content"
import { requireActiveMembershipOrAdmin } from "@/lib/auth/server-guards"
import { generatePageMetadata } from "@/lib/metadata"
import { Separator } from "@/components/ui/separator"

export const metadata = generatePageMetadata({
  title: "Network data",
  description: "View and manage your network data.",
  url: "/network/data",
})

export default async function NetworkDataPage() {
  await requireActiveMembershipOrAdmin()

  return (
    <>
      <DashboardBreadcrumb />
      <div className="flex flex-1 flex-col gap-6 p-6 lg:p-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Network data</h1>
            <p className="text-sm text-muted-foreground">View and manage your network data.</p>
          </div>
        </header>

        <Separator />

        <NetworkDataContent />
      </div>
    </>
  )
}
