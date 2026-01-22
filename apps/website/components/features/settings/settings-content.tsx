"use client"

import { useEffect } from "react"
import { Bell, Palette, Shield, User, KeyRound } from "lucide-react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useChangePassword, usePostApiAuthChangeEmailOtp, useSendVerificationEmail, useUpdateUser } from "@/lib/api/auth/auth"
import { useSession } from "@/lib/auth/hooks"
import { NotificationSettings } from "./notifications/notification-settings"
import { AppearanceSettings } from "./appearance/appearance-settings"
import { SecuritySettings } from "./security/security-settings"
import { ProfileSettings } from "./profile/profile-settings"
import { AccountSettings } from "./account/account-settings"
import { useSettingsStore } from "@/lib/stores/settings/settings-store"
import { useTabsStore } from "@/lib/stores/ui/tabs-store"

type SettingsContentProps = {
  user: {
    id: string
    name: string
    username?: string | null
    displayUsername?: string | null
    email: string
    image?: string | null
    emailVerified: boolean
    createdAt: Date
  }
}

export function SettingsContent({ user: initialUser }: SettingsContentProps) {
  const queryClient = useQueryClient()
  const { data: session, refetch: refetchSession } = useSession()
  const user = useSettingsStore((state) => state.user)
  const notificationPrefs = useSettingsStore((state) => state.notificationPrefs)
  const setUser = useSettingsStore((state) => state.setUser)
  const updateUser = useSettingsStore((state) => state.updateUser)
  const setNotificationPref = useSettingsStore((state) => state.setNotificationPref)
  const resolvedUser = user ?? initialUser
  const activeTab = useTabsStore((state) => state.activeTabs.settings ?? "profile")
  const setActiveTab = useTabsStore((state) => state.setActiveTab)

  useEffect(() => {
    if (!user) {
      setUser(initialUser)
    }
  }, [initialUser, setUser, user])

  useEffect(() => {
    if (session?.user) {
      const sessionUsername = "username" in session.user
        ? (session.user as { username?: string | null }).username ?? null
        : null
      const sessionDisplayUsername = "displayUsername" in session.user
        ? (session.user as { displayUsername?: string | null }).displayUsername ?? null
        : null
      setUser({
        id: session.user.id,
        name: session.user.name,
        username: sessionUsername,
        displayUsername: sessionDisplayUsername,
        email: session.user.email,
        image: session.user.image,
        emailVerified: session.user.emailVerified,
        createdAt: session.user.createdAt ? new Date(session.user.createdAt) : new Date(),
      })
    }
  }, [session?.user, setUser])


  const changePasswordMutation = useChangePassword()
  const sendVerificationEmailMutation = useSendVerificationEmail()
  const updateUserMutation = useUpdateUser()


  const twoFactorEnabled = session?.user?.twoFactorEnabled ?? false

  const handleNotificationChange = (key: keyof typeof notificationPrefs, value: boolean) => {
    setNotificationPref(key, value)
    toast.success("Notification preferences updated")
  }

  const handleToggle2FA = async (enabled: boolean) => {
    if (enabled === twoFactorEnabled) {
      return
    }
    await refetchSession()
    queryClient.invalidateQueries({ queryKey: ["/api/auth/get-session"] })
  }

  const handleUpdateProfile = async (data: { name: string; image?: string | null }) => {
    const updateData: { name: string; image?: string | null } = {
      name: data.name,
    }
    if (data.image !== undefined) {
      updateData.image = data.image
    }
    await updateUserMutation.mutateAsync({
      data: updateData,
    })
    await refetchSession()
    updateUser({
      name: data.name,
      image: data.image !== undefined ? data.image : resolvedUser.image,
    })
    queryClient.invalidateQueries({ queryKey: ["/api/auth/get-session"] })
  }

  const handleChangeUsername = async (newUsername: string) => {
    type UpdateUserPayload = Parameters<typeof updateUserMutation.mutateAsync>[0]["data"] & {
      username?: string
    }
    const updatePayload: UpdateUserPayload = { username: newUsername }
    await updateUserMutation.mutateAsync({
      data: updatePayload,
    })
    await refetchSession()
    updateUser({
      username: newUsername,
      displayUsername: newUsername,
    })
    queryClient.invalidateQueries({ queryKey: ["/api/auth/get-session"] })
  }

  const changeEmailOtpMutation = usePostApiAuthChangeEmailOtp()

  const handleChangeEmail = async (newEmail: string): Promise<string | void> => {
    await changeEmailOtpMutation.mutateAsync({
      data: { newEmail },
    })
    return newEmail
  }

  const handleChangePassword = async (currentPassword: string, newPassword: string) => {
    await changePasswordMutation.mutateAsync({
      data: {
        currentPassword,
        newPassword,
      },
    })
  }

  const handleResendVerification = async () => {
    await sendVerificationEmailMutation.mutateAsync({
      data: {
        email: resolvedUser.email,
      },
    })
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab("settings", value)}
      className="space-y-6"
    >
      <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-flex">
        <TabsTrigger value="profile" className="gap-1.5">
          <User className="size-4" />
          <span className="hidden sm:inline">Profile</span>
        </TabsTrigger>
        <TabsTrigger value="account" className="gap-1.5">
          <KeyRound className="size-4" />
          <span className="hidden sm:inline">Account</span>
        </TabsTrigger>
        <TabsTrigger value="notifications" className="gap-1.5" disabled>
          <Bell className="size-4" />
          <span className="hidden sm:inline">Notifications</span>
        </TabsTrigger>
        <TabsTrigger value="appearance" className="gap-1.5">
          <Palette className="size-4" />
          <span className="hidden sm:inline">Appearance</span>
        </TabsTrigger>
        <TabsTrigger value="security" className="gap-1.5">
          <Shield className="size-4" />
          <span className="hidden sm:inline">Security</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="profile">
        <ProfileSettings
          user={resolvedUser}
          onUpdateProfile={handleUpdateProfile}
        />
      </TabsContent>

      <TabsContent value="account">
        <AccountSettings
          currentUsername={resolvedUser.username}
          currentEmail={resolvedUser.email}
          emailVerified={resolvedUser.emailVerified}
          onChangeUsername={handleChangeUsername}
          onChangeEmail={handleChangeEmail}
          onChangePassword={handleChangePassword}
          onResendVerification={handleResendVerification}
          onEmailVerified={async () => {
            queryClient.invalidateQueries({ queryKey: ["/api/auth/get-session"] })
            await refetchSession()
          }}
        />
      </TabsContent>

      <TabsContent value="notifications">
        <NotificationSettings
          expirationAlerts={notificationPrefs.expirationAlerts}
          signalAlerts={notificationPrefs.signalAlerts}
          commissionAlerts={notificationPrefs.commissionAlerts}
          onExpirationAlertsChange={(v) => handleNotificationChange("expirationAlerts", v)}
          onSignalAlertsChange={(v) => handleNotificationChange("signalAlerts", v)}
          onCommissionAlertsChange={(v) => handleNotificationChange("commissionAlerts", v)}
        />
      </TabsContent>

      <TabsContent value="appearance">
        <AppearanceSettings />
      </TabsContent>

      <TabsContent value="security">
        <SecuritySettings
          twoFactorEnabled={twoFactorEnabled}
          onToggle2FA={handleToggle2FA}
        />
      </TabsContent>
    </Tabs>
  )
}
