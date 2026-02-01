import { DashboardBreadcrumb } from "@/components/features/dashboard/breadcrumb/dashboard-breadcrumb"
import { SignalsChat } from "@/components/features/signals/signals-chat"

export default function SignalsPage() {
  return (
    <>
      <DashboardBreadcrumb />
      <div className="flex flex-1 flex-col p-6 lg:p-8 pt-0 lg:pt-0 h-[calc(100vh-4rem)]">
        <div className="flex-1 min-h-0 w-full h-full">
          <SignalsChat />
        </div>
      </div>
    </>
  )
}
