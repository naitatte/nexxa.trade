"use client"

import { useState } from "react"
import { Laptop, LogOut, Shield, ShieldCheck, Smartphone, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { LoadingSpinner } from "@/lib/loading-state/components"
import { useLoadingState } from "@/lib/loading-state/hooks"
import { translateErrorFromResponse } from "@/lib/error-translations"
import { useSessions, useRevokeSession, useRevokeOtherSessions } from "@/lib/auth/hooks/use-sessions"
import { EnableTwoFactorDialog } from "./dialogs/enable-two-factor-dialog"
import { DisableTwoFactorDialog } from "./dialogs/disable-two-factor-dialog"

type SecuritySettingsProps = {
  twoFactorEnabled?: boolean
  onToggle2FA?: (enabled: boolean) => void
}

function getDeviceIcon(device: string) {
  if (device.toLowerCase().includes("mobile") || device.toLowerCase().includes("phone")) {
    return Smartphone
  }
  return Laptop
}

function formatLastActive(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

export function SecuritySettings({
  twoFactorEnabled = false,
  onToggle2FA,
}: SecuritySettingsProps) {
  const [enableDialogOpen, setEnableDialogOpen] = useState(false)
  const [disableDialogOpen, setDisableDialogOpen] = useState(false)
  const [revokeAllDialogOpen, setRevokeAllDialogOpen] = useState(false)

  const { data: sessions = [], isLoading: isLoadingSessions, error: sessionsError } = useSessions()
  const revokeSessionMutation = useRevokeSession()
  const revokeOtherSessionsMutation = useRevokeOtherSessions()

  const { setLoading: setRevokeLoading, setIdle: setRevokeIdle, setSuccess: setRevokeSuccess, setError: setRevokeError } = useLoadingState()

  const [revokingSessionToken, setRevokingSessionToken] = useState<string | null>(null)

  const handleRevokeSession = async (sessionToken: string) => {
    setRevokingSessionToken(sessionToken)
    setRevokeLoading("Revoking session...")
    try {
      await revokeSessionMutation.mutateAsync({
        data: { token: sessionToken },
      })
      setRevokeSuccess("Session revoked successfully")
    } catch (error) {
      const errorTranslation = translateErrorFromResponse(
        error,
        "Failed to revoke session"
      )
      setRevokeError(errorTranslation.message, errorTranslation.message)
    } finally {
      setRevokingSessionToken(null)
      setRevokeIdle()
    }
  }

  const handleRevokeAllClick = () => {
    setRevokeAllDialogOpen(true)
  }

  const handleRevokeAll = async () => {
    setRevokeAllDialogOpen(false)
    setRevokeLoading("Revoking all other sessions...")
    try {
      await revokeOtherSessionsMutation.mutateAsync({
        data: {},
      })
      setRevokeSuccess("All other sessions revoked successfully")
    } catch (error) {
      const errorTranslation = translateErrorFromResponse(
        error,
        "Failed to revoke sessions"
      )
      setRevokeError(errorTranslation.message, errorTranslation.message)
    } finally {
      setRevokeIdle()
    }
  }

  const handleToggle2FA = (checked: boolean) => {
    if (checked && !twoFactorEnabled) {
      setEnableDialogOpen(true)
    } else if (!checked && twoFactorEnabled) {
      setDisableDialogOpen(true)
    }
  }

  const handle2FASuccess = async () => {
    await onToggle2FA?.(!twoFactorEnabled)
  }

  return (
    <div className="grid gap-6 rounded-lg border p-6 text-sm">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Shield className="size-4 text-muted-foreground" />
          <h3 className="font-medium">Session & security</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Manage your active sessions and security settings.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-4 text-muted-foreground" />
            <div className="space-y-0.5">
              <Label htmlFor="two-factor" className="text-sm font-medium">
                Two-factor authentication
              </Label>
              <p className="text-xs text-muted-foreground">
                Add an extra layer of security to protect your wallet and network.
              </p>
            </div>
          </div>
          <Switch
            id="two-factor"
            checked={twoFactorEnabled}
            onCheckedChange={handleToggle2FA}
          />
        </div>
      </div>

      <div className="space-y-3 border-t pt-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Active sessions
          </h4>
          {sessions.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-destructive hover:text-destructive"
              onClick={handleRevokeAllClick}
              disabled={revokeOtherSessionsMutation.isPending}
            >
              {revokeOtherSessionsMutation.isPending ? (
                <>
                  <LoadingSpinner size="sm" className="mr-1.5" />
                  Revoking...
                </>
              ) : (
                <>
                  <LogOut className="mr-1.5 size-3" />
                  Log out all other devices
                </>
              )}
            </Button>
          )}
        </div>

        {isLoadingSessions ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-4 rounded-md border p-3"
              >
                <div className="flex items-center gap-3 flex-1">
                  <Skeleton className="size-4" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : sessionsError ? (
          <p className="text-xs text-destructive">Failed to load sessions. Please try again.</p>
        ) : sessions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No active sessions found.</p>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => {
              const DeviceIcon = getDeviceIcon(session.device)
              const isRevoking = revokingSessionToken === session.token
              return (
                <div
                  key={session.id}
                  className="flex items-center justify-between gap-4 rounded-md border p-3"
                >
                  <div className="flex items-center gap-3">
                    <DeviceIcon className="size-4 text-muted-foreground" />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {session.browser} on {session.device}
                        </span>
                        {session.isCurrent && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            Current
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {session.location} · {formatLastActive(session.lastActive)}
                      </p>
                    </div>
                  </div>
                  {!session.isCurrent && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleRevokeSession(session.token)}
                      disabled={isRevoking}
                    >
                      {isRevoking ? (
                        <>
                          <LoadingSpinner size="sm" className="mr-1.5" />
                          Revoking...
                        </>
                      ) : (
                        "Revoke"
                      )}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <EnableTwoFactorDialog
        open={enableDialogOpen}
        onOpenChange={setEnableDialogOpen}
        onSuccess={handle2FASuccess}
      />

      <DisableTwoFactorDialog
        open={disableDialogOpen}
        onOpenChange={setDisableDialogOpen}
        onSuccess={handle2FASuccess}
      />

      <Dialog open={revokeAllDialogOpen} onOpenChange={setRevokeAllDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-left">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              <DialogTitle>Log out all other devices?</DialogTitle>
            </div>
            <DialogDescription>
              This will immediately log out all your other active sessions. You will remain logged in on this device.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRevokeAllDialogOpen(false)}
              disabled={revokeOtherSessionsMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevokeAll}
              disabled={revokeOtherSessionsMutation.isPending}
            >
              {revokeOtherSessionsMutation.isPending ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Revoking...
                </>
              ) : (
                <>
                  <LogOut className="mr-2 size-4" />
                  Log out all other devices
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}