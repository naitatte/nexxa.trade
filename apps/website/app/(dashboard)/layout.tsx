import { AppSidebar } from "@/components/features/dashboard/sidebar/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { auth } from "@/lib/auth/server"
import { getRequestHeaders } from "@/lib/auth/request-headers"
import { redirect } from "next/navigation"
import { PageTransition } from "@/components/features/dashboard/transitions/page-transition"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = await getRequestHeaders()
  
  const session = await auth.api.getSession({
    headers: headersList as unknown as Headers,
  })

  if (!session) {
    redirect("/login")
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <PageTransition>
          {children}
        </PageTransition>
      </SidebarInset>
    </SidebarProvider>
  )
}
