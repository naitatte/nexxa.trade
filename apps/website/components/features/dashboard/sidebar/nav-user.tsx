"use client"

import {
  ChevronsUpDown,
  LogOut,
  CheckCircle2,
  XCircle,
  Settings2,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signOut } from "@/lib/auth/hooks"
import { toast } from "sonner"
import { useLoadingState } from "@/lib/loading-state/hooks"
import { LoadingSpinner } from "@/lib/loading-state/components"
import { useSession } from "@/lib/auth/hooks"
import type { AuthUser } from "@/lib/auth/types"
import { useUserPermissions, useUser } from "@/hooks/use-user-permissions"
import { useGetApiMembershipUsersUserId } from "@/lib/api/membership/membership"
import { format } from "date-fns"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export function NavUser() {
  const { isMobile } = useSidebar()
  const router = useRouter()
  const { state: loadingState, setLoading, setIdle } = useLoadingState()
  const { data: sessionData, isPending } = useSession()
  const permissions = useUserPermissions()
  const userData = useUser()
  const userId = sessionData?.user?.id
  const { data: membershipData } = useGetApiMembershipUsersUserId(userId || "", {
    query: { enabled: !!userId }
  })
  
  const user = sessionData?.user
  const userName = user?.name || ""
  const userEmail = user?.email || ""
  const userAvatar = user?.image || ""

  const handleSignOut = async () => {
    setLoading("Signing out...")
    try {
      await signOut({
        fetchOptions: {
          onSuccess: () => {
            setIdle()
            toast.success("Successfully signed out")
            router.push("/login")
            router.refresh()
          },
        },
      })
    } catch {
      setIdle()
      toast.error("Failed to sign out")
    }
  }

  if (isPending) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" disabled>
            <Avatar className="h-8 w-8 rounded-lg">
              <AvatarFallback className="rounded-lg">
                <LoadingSpinner size="sm" />
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">Loading...</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  if (!sessionData || !user || !userName || !userEmail) {
    return null
  }

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U"

  const sessionUser = user as AuthUser
  const membershipStatus = membershipData?.status || sessionUser.membershipStatus || permissions?.status || "inactive"
  const isActive = membershipStatus === "active"
  const status = isActive ? "Active" : "Inactive"
  
  const rawTier = membershipData?.tier || sessionUser.membershipTier
  const tierName = rawTier 
    ? rawTier.split('_').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
    : userData?.role && userData.role !== 'guest'
      ? userData.role.charAt(0).toUpperCase() + userData.role.slice(1)
      : "No Membership"

  const statusIcon = isActive ? (
    <CheckCircle2 className="size-3 text-green-500" />
  ) : (
    <XCircle className="size-3 text-red-500" />
  )

  const expirationDate = membershipData?.expiresAt
    ? format(new Date(membershipData.expiresAt), "dd/MM/yyyy")
    : userData?.expirationDate
    ? format(new Date(userData.expirationDate), "dd/MM/yyyy")
    : "N/A"

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={userAvatar} alt={userName} />
                <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{userName}</span>
                <span className="truncate text-xs">{userEmail}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={userAvatar} alt={userName} />
                  <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{userName}</span>
                  <span className="truncate text-xs">{userEmail}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="px-2 py-2 space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">Membership:</span>
                <span className="font-medium text-foreground">{tierName}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">Status:</span>
                <div className="flex items-center gap-1.5">
                  <span className={`font-medium ${isActive ? "text-green-600" : "text-red-600"}`}>
                    {status}
                  </span>
                  {statusIcon}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">Expires:</span>
                <span className="font-medium text-foreground">{expirationDate}</span>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings" className="cursor-pointer">
                <Settings2 />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={handleSignOut}
              disabled={loadingState === "loading"}
            >
              {loadingState === "loading" && <LoadingSpinner size="sm" />}
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
