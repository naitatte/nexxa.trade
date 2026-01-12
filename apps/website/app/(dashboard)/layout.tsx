import { AppSidebar } from "@/components/features/dashboard/sidebar/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { auth } from "@/lib/auth/server"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = await headers()
  
  const requestHeaders = new Headers()
  const cookieHeader = headersList.get("cookie")
  if (cookieHeader) {
    requestHeaders.set("cookie", cookieHeader)
  }
  
  const session = await auth.api.getSession({
    headers: requestHeaders,
  })

  if (!session) {
    redirect("/login")
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
