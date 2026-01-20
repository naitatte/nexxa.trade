import { redirect } from "next/navigation"
import { DashboardBreadcrumb } from "@/components/features/dashboard/breadcrumb/dashboard-breadcrumb"
import { SettingsContent } from "@/components/features/settings/settings-content"
import { auth } from "@/lib/auth/server"
import { getRequestHeaders } from "@/lib/auth/request-headers"

export default async function Settings() {
  const headersList = await getRequestHeaders()
  
  const session = await auth.api.getSession({
    headers: headersList as unknown as Headers,
  })

  if (!session) redirect("/login")

  const user = {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
    emailVerified: session.user.emailVerified,
    createdAt: session.user.createdAt ? new Date(session.user.createdAt) : new Date(),
  }

  return (
    <>
      <DashboardBreadcrumb />
      <div className="flex flex-1 flex-col gap-8 p-6 lg:p-8">
        <header className="flex items-center justify-between border-b pb-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
            <p className="text-sm text-muted-foreground">Manage your account settings and preferences.</p>
          </div>
        </header>
        <SettingsContent user={user} />
      </div>
    </>
  )
}
