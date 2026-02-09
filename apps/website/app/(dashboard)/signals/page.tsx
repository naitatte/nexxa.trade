import { DashboardBreadcrumb } from "@/components/features/dashboard/breadcrumb/dashboard-breadcrumb"
import { SignalsChat } from "@/components/features/signals/signals-chat"
import { requireActiveMembershipOrAdmin } from "@/lib/auth/server-guards"

export default async function SignalsPage() {
  await requireActiveMembershipOrAdmin()
  return (
    <div className="flex flex-col h-[100svh]">
      <DashboardBreadcrumb />
      <div className="flex-1 min-h-0 p-6 lg:p-8 pt-0 lg:pt-0">
        <SignalsChat />
      </div>
    </div>
  )
}
