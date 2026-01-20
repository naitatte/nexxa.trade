"use client"

import { useState } from "react"
import { KeyRound, Mail, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { VerifyEmailChangeDialog } from "./dialogs/verify-email-change-dialog"
import { useLoadingState } from "@/lib/loading-state/hooks"
import { translateErrorFromResponse } from "@/lib/error-translations"

type AccountSettingsProps = {
  currentEmail: string
  onChangeEmail?: (newEmail: string) => Promise<string | void>
  onChangePassword?: (currentPassword: string, newPassword: string) => Promise<void>
  onResendVerification?: () => Promise<void>
  onEmailVerified?: () => Promise<void>
  emailVerified?: boolean
}

export function AccountSettings({
  currentEmail,
  onChangeEmail,
  onChangePassword,
  onResendVerification,
  onEmailVerified,
  emailVerified = false,
}: AccountSettingsProps) {
  const [isChangingEmail, setIsChangingEmail] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [newEmail, setNewEmail] = useState("")
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [showVerifyDialog, setShowVerifyDialog] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const { isLoading, setLoading, setSuccess, setError, setIdle } = useLoadingState()

  const handleEmailChange = async () => {
    if (!newEmail.trim()) {
      setError("Email cannot be empty", "MISSING_REQUIRED_FIELD")
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      setError("Please enter a valid email", "INVALID_EMAIL")
      return
    }

    if (newEmail.trim() === currentEmail) {
      setError("New email must be different from current email", "INVALID_INPUT")
      return
    }

    setLoading("Sending verification email...")
    try {
      const emailToVerify = newEmail.trim()
      await onChangeEmail?.(emailToVerify)
      setPendingEmail(emailToVerify)
      setShowVerifyDialog(true)
      setIsChangingEmail(false)
      setNewEmail("")
      setSuccess("Verification email sent! Please check your inbox.")
      setIdle()
    } catch (error) {
      const errorTranslation = translateErrorFromResponse(
        error,
        "Failed to send verification email"
      )
      setError(errorTranslation.message, errorTranslation.message)
      setIdle()
    }
  }

  const handleVerificationSuccess = async () => {
    setPendingEmail(null)
    setShowVerifyDialog(false)
    await onEmailVerified?.()
  }

  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("All password fields are required", "MISSING_REQUIRED_FIELD")
      return
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters", "PASSWORD_TOO_SHORT")
      return
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match", "PASSWORDS_DO_NOT_MATCH")
      return
    }

    setLoading("Updating password...")
    try {
      await onChangePassword?.(currentPassword, newPassword)
      setIsChangingPassword(false)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setSuccess("Password updated successfully")
      setIdle()
    } catch (error) {
      const errorTranslation = translateErrorFromResponse(
        error,
        "Failed to update password"
      )
      setError(errorTranslation.message, errorTranslation.message)
      setIdle()
    }
  }

  const handleResendVerification = async () => {
    setLoading("Sending verification email...")
    try {
      await onResendVerification?.()
      setSuccess("Verification email sent! Please check your inbox.")
    } catch (error) {
      const errorTranslation = translateErrorFromResponse(
        error,
        "Failed to send verification email"
      )
      setError(errorTranslation.message, errorTranslation.message)
    } finally {
      setIdle()
    }
  }

  return (
    <div className="grid gap-6 rounded-lg border p-6 text-sm">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-muted-foreground" />
          <h3 className="font-medium">Account settings</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Manage your email and password.
        </p>
      </div>

      {!emailVerified && (
        <div className="flex items-center gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
          <AlertTriangle className="size-4 text-amber-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Email not verified
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Please verify your email to secure your account.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={handleResendVerification}
            disabled={isLoading}
          >
            {isLoading ? "Sending..." : "Resend"}
          </Button>
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Mail className="size-3.5 text-muted-foreground" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Email address
            </span>
          </div>

          {isChangingEmail ? (
            <div className="ml-5 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="new-email">New email</Label>
                <Input
                  id="new-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Enter new email address"
                  className="h-9"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleEmailChange}
                  disabled={isLoading}
                >
                  Save changes
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsChangingEmail(false)
                    setNewEmail("")
                  }}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="ml-5 flex items-center justify-between">
              <p className="font-medium">{currentEmail}</p>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setIsChangingEmail(true)}
              >
                Change email
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-3 border-t pt-4">
          <div className="flex items-center gap-2">
            <KeyRound className="size-3.5 text-muted-foreground" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Password
            </span>
          </div>

          {isChangingPassword ? (
            <div className="ml-5 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="h-9"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handlePasswordChange}
                  disabled={isLoading}
                >
                  Update password
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsChangingPassword(false)
                    setCurrentPassword("")
                    setNewPassword("")
                    setConfirmPassword("")
                  }}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="ml-5 flex items-center justify-between">
              <p className="font-medium">••••••••</p>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setIsChangingPassword(true)}
              >
                Change password
              </Button>
            </div>
          )}
        </div>
      </div>

      {pendingEmail && (
        <VerifyEmailChangeDialog
          open={showVerifyDialog}
          onOpenChange={setShowVerifyDialog}
          newEmail={pendingEmail}
          onSuccess={handleVerificationSuccess}
        />
      )}
    </div>
  )
}