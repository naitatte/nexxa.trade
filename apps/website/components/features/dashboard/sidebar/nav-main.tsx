"use client"

import { ChevronRight, Lock, type LucideIcon } from "lucide-react"
import Link from "next/link"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
    SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"

type NavItem = {
  title: string
  url: string
  icon: LucideIcon
  isActive?: boolean
  isDisabled?: boolean
  items?: {
    title: string
    url: string
  }[]
}

type NavGroup = {
  label: string
  items: NavItem[]
}

export function NavMain({
  groups,
}: {
  groups: NavGroup[]
}) {
  return (
    <>
      {groups.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => (
                <Collapsible key={item.title} asChild defaultOpen={item.isActive}>
                  <SidebarMenuItem>
                    {item.isDisabled ? (
                      <SidebarMenuButton 
                        disabled 
                        tooltip={item.title}
                        className="opacity-50 cursor-not-allowed"
                      >
                        <item.icon />
                        <span>{item.title}</span>
                        <Lock className="ml-auto size-4" />
                      </SidebarMenuButton>
                    ) : (
                      <>
                        {item.items?.length ? (
                          <>
                            <SidebarMenuButton tooltip={item.title}>
                              <item.icon />
                              <span>{item.title}</span>
                            </SidebarMenuButton>
                            <CollapsibleTrigger asChild>
                              <SidebarMenuAction className="data-[state=open]:rotate-90">
                                <ChevronRight />
                                <span className="sr-only">Toggle</span>
                              </SidebarMenuAction>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <SidebarMenuSub>
                                {item.items?.map((subItem) => (
                                  <SidebarMenuSubItem key={subItem.title}>
                                    <SidebarMenuSubButton asChild>
                                      <Link href={subItem.url}>
                                        <span>{subItem.title}</span>
                                      </Link>
                                    </SidebarMenuSubButton>
                                  </SidebarMenuSubItem>
                                ))}
                              </SidebarMenuSub>
                            </CollapsibleContent>
                          </>
                        ) : (
                          <SidebarMenuButton asChild tooltip={item.title}>
                            <Link href={item.url}>
                              <item.icon />
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        )}
                      </>
                    )}
                  </SidebarMenuItem>
                </Collapsible>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  )
}
