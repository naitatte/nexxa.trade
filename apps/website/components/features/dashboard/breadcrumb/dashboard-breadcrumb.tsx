"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Fragment } from "react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

const routeLabels: Record<string, string> = {
  dashboard: "Dashboard",
  signals: "Signals",
  network: "Network",
  chart: "Chart",
  data: "Data",
  wallet: "Wallet",
  membership: "Membership",
  subscription: "Subscription",
  settings: "Settings",
  profile: "Profile",
}

function formatSegment(segment: string): string {
  if (routeLabels[segment]) {
    return routeLabels[segment]
  }
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

type BreadcrumbSegment = {
  label: string
  href: string
}

function generateBreadcrumbs(pathname: string): BreadcrumbSegment[] {
  const segments = pathname.split("/").filter(Boolean)
  
  const breadcrumbs: BreadcrumbSegment[] = []
  
  if (segments.length > 0) {
    const firstSegment = segments[0]
    
    if (firstSegment === "dashboard") {
      breadcrumbs.push({
        label: "Dashboard",
        href: "/dashboard",
      })
      
      segments.slice(1).forEach((segment, index) => {
        const href = "/" + segments.slice(0, index + 2).join("/")
        breadcrumbs.push({
          label: formatSegment(segment),
          href,
        })
      })
    } else {
      breadcrumbs.push({
        label: "Dashboard",
        href: "/dashboard",
      })
      
      segments.forEach((segment, index) => {
        const href = "/" + segments.slice(0, index + 1).join("/")
        breadcrumbs.push({
          label: formatSegment(segment),
          href,
        })
      })
    }
  }
  
  return breadcrumbs
}

type DashboardBreadcrumbProps = {
  className?: string
}

export function DashboardBreadcrumb({ className }: DashboardBreadcrumbProps) {
  const pathname = usePathname()
  const breadcrumbs = generateBreadcrumbs(pathname)

  return (
    <header className={`flex h-16 shrink-0 items-center gap-2 ${className ?? ""}`}>
      <div className="flex items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1

              return (
                <Fragment key={crumb.href}>
                  {index > 0 && (
                    <BreadcrumbSeparator className="hidden md:block" />
                  )}
                  <BreadcrumbItem className={index === 0 && breadcrumbs.length > 1 ? "hidden md:block" : ""}>
                    {isLast ? (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link href={crumb.href}>{crumb.label}</Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </Fragment>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  )
}
