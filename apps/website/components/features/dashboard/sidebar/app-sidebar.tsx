"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import {
  LayoutDashboard,
  Radio,
  Network,
  Wallet,
  Crown,
} from "lucide-react"
import { useUserPermissions } from "@/hooks/use-user-permissions"
import { NavMain } from "@/components/features/dashboard/sidebar/nav-main"
import { NavUser } from "@/components/features/dashboard/sidebar/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupContent,
} from "@/components/ui/sidebar"
import type { LucideIcon } from "lucide-react"

const iconMap: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  signals: Radio,
  network: Network,
  withdrawals: Wallet,
  membership: Crown,
}

type NavGroup = {
  label: string
  items: Array<{
    title: string
    url: string
    icon: LucideIcon
    isActive?: boolean
    isDisabled?: boolean
    items?: Array<{ title: string; url: string }>
  }>
}

type DashboardItem = {
  title: string
  url: string
  icon: LucideIcon
  isActive?: boolean
  isDisabled?: boolean
}

type UserPermissions = NonNullable<ReturnType<typeof useUserPermissions>>
type MenuConfig = UserPermissions["menuConfig"]
type UserRole = UserPermissions["role"]

function buildDashboardItem(
  menuConfig: MenuConfig
): DashboardItem | null {
  const dashboard = menuConfig.dashboard
  if (!dashboard) return null

  return {
    title: dashboard.title,
    url: dashboard.url,
    icon: iconMap.dashboard,
    isActive: dashboard.isActive,
    isDisabled: dashboard.isDisabled,
  }
}

function buildNavGroups(
  menuConfig: MenuConfig,
  role: UserRole
): NavGroup[] {
  const groups: NavGroup[] = []
  
  const tradingItems: NavGroup["items"] = []
  const businessItems: NavGroup["items"] = []
  const adminItems: NavGroup["items"] = []

  const addItem = (
    key: keyof typeof menuConfig,
    iconKey: string,
    targetArray: NavGroup["items"]
  ) => {
    const item = menuConfig[key]
    if (!item || key === "settings" || key === "dashboard" || key === "membership") return

    const icon = iconMap[iconKey] || LayoutDashboard

    targetArray.push({
      title: item.title,
      url: item.items?.length ? "#" : item.url,
      icon,
      isActive: item.isActive,
      isDisabled: item.isDisabled,
      items: item.items?.map((subItem) => ({
        title: subItem.title,
        url: subItem.url,
      })),
    })
  }

  if (role === "admin") {
    tradingItems.push({
      title: "Signals",
      url: "/signals",
      icon: iconMap.signals,
    })
    businessItems.push({
      title: "Network",
      url: "#",
      icon: iconMap.network,
      items: [
        {
          title: "Network chart",
          url: "/network/chart",
        },
        {
          title: "Network data",
          url: "/network/data",
        },
      ],
    })
    businessItems.push({
      title: "Withdrawals",
      url: "/withdrawals",
      icon: iconMap.withdrawals,
    })
    adminItems.push({
      title: "Signals manager",
      url: "/signals",
      icon: iconMap.signals,
    })
    if (menuConfig.network) {
      adminItems.push({
        title: menuConfig.network.title,
        url: menuConfig.network.url,
        icon: iconMap.network,
        isActive: menuConfig.network.isActive,
        isDisabled: menuConfig.network.isDisabled,
      })
    }
    if (menuConfig.withdrawals) {
      adminItems.push({
        title: menuConfig.withdrawals.title,
        url: menuConfig.withdrawals.url,
        icon: iconMap.withdrawals,
        isActive: menuConfig.withdrawals.isActive,
        isDisabled: menuConfig.withdrawals.isDisabled,
      })
    }
  } else {
    addItem("signals", "signals", tradingItems)
    if (role === "networker" || role === "subscriber") {
      if (menuConfig.network) {
        addItem("network", "network", businessItems)
      }
      if (menuConfig.withdrawals) {
        addItem("withdrawals", "withdrawals", businessItems)
      }
    }
  }

  if (tradingItems.length > 0) {
    groups.push({
      label: "Trading",
      items: tradingItems,
    })
  }

  if (businessItems.length > 0) {
    groups.push({
      label: "Business",
      items: businessItems,
    })
  }

  if (adminItems.length > 0) {
    groups.push({
      label: "Administration",
      items: adminItems,
    })
  }

  return groups
}

function buildMembershipItem(
  menuConfig: MenuConfig
): DashboardItem | null {
  const membership = menuConfig.membership
  if (!membership) return null

  return {
    title: membership.title,
    url: membership.url,
    icon: iconMap.membership,
    isActive: membership.isActive,
    isDisabled: membership.isDisabled,
  }
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const permissions = useUserPermissions()

  if (!permissions) {
    return (
      <Sidebar variant="inset" {...props}>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" disabled>
                <div className="flex items-center justify-start">
                  <Image
                    src="/graphics/logo-light.png"
                    alt="Logo"
                    width={360}
                    height={76}
                    className="h-7 w-auto dark:hidden"
                    priority
                  />
                  <Image
                    src="/graphics/logo-dark.png"
                    alt="Logo"
                    width={360}
                    height={76}
                    className="hidden h-7 w-auto dark:block"
                    priority
                  />
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent />
        <SidebarFooter>
          <NavUser />
        </SidebarFooter>
      </Sidebar>
    )
  }

  const navGroups = buildNavGroups(permissions.menuConfig, permissions.role)
  const dashboardItem = buildDashboardItem(permissions.menuConfig)
  const membershipItem = buildMembershipItem(permissions.menuConfig)

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <Link href="/dashboard" className="flex h-12 items-center justify-start px-2">
              <Image
                src="/graphics/logo-light.png"
                alt="Logo"
                width={360}
                height={76}
                className="h-7 w-auto dark:hidden"
                priority
              />
              <Image
                src="/graphics/logo-dark.png"
                alt="Logo"
                width={360}
                height={76}
                className="hidden h-7 w-auto dark:block"
                priority
              />
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {dashboardItem && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={dashboardItem.title}>
                    <Link href={dashboardItem.url}>
                      <dashboardItem.icon />
                      <span>{dashboardItem.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        <NavMain groups={navGroups} />
      </SidebarContent>
      <SidebarFooter>
        {membershipItem && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild 
                    tooltip={membershipItem.title}
                  >
                    <Link href={membershipItem.url}>
                      <membershipItem.icon />
                      <span>{membershipItem.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
