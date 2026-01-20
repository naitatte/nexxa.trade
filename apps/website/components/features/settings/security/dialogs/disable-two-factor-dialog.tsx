"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { useSession } from "@/lib/auth/hooks"
import { getApiBaseUrl } from "@/lib/api/base-url"
import { useLoadingState } from "@/lib/loading-state/hooks"
import { translateErrorFromResponse } from "@/lib/error-translations"

type Step = "password" | "code"

type DisableTwoFactorDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function DisableTwoFactorDialog({
  open,
  onOpenChange,
  onSuccess,
}: DisableTwoFactorDialogProps) {
  const [step, setStep] = useState<Step>("password")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const { isLoading, setLoading, setSuccess, setError, setIdle } = useLoadingState()
  const queryClient = useQueryClient()
  const { refetch: refetchSession } = useSession()

  const handlePasswordSubmit = () => {
    if (!password.trim()) {
      setError("Please enter your password", "MISSING_REQUIRED_FIELD")
      return
    }
    setStep("code")
  }

  const handleDisable = async () => {
    if (code.trim().length !== 6) {
      setError("Please enter a valid 6-digit code", "INVALID_INPUT")
      return
    }

    setLoading("Disabling two-factor authentication...")
    try {
      const apiBaseUrl =
        getApiBaseUrl() ||
        (process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "").replace(/\/api\/auth\/?$/, "")
      const response = await fetch(
        `${apiBaseUrl}/api/auth/two-factor/disable`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ password, code: code.trim() }),
        }
      )
      if (!response.ok) {
        const errorText = await response.text().catch(() => "Failed to disable")
        const errorTranslation = translateErrorFromResponse(errorText)
        throw new Error(errorTranslation.message)
      }
      setSuccess("Two-factor authentication disabled")
      queryClient.invalidateQueries({ queryKey: ["/api/auth/get-session"] })
      await refetchSession()
      setIdle()
      handleClose()
      await onSuccess?.()
    } catch (error: unknown) {
      const errorTranslation = translateErrorFromResponse(
        error,
        "Failed to disable two-factor authentication. Please try again."
      )
      setError(errorTranslation.message, errorTranslation.message)
      setIdle()
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      setStep("password")
      setPassword("")
      setCode("")
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {step === "password" && (
          <>
            <DialogHeader className="text-left">
              <DialogTitle>Disable two-factor authentication</DialogTitle>
              <DialogDescription>
                Enter your password to continue. You&apos;ll need to verify with your
                authenticator code in the next step.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isLoading && password.trim()) {
                      handlePasswordSubmit()
                    }
                  }}
                  autoFocus
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button onClick={handlePasswordSubmit} disabled={isLoading || !password.trim()}>
                Continue
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "code" && (
          <>
            <DialogHeader className="text-left">
              <DialogTitle>Enter authentication code</DialogTitle>
              <DialogDescription>
                Enter the 6-digit code from your authenticator app to disable
                two-factor authentication. Your account will be less secure without this protection.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 flex justify-center">
              <InputOTP
                id="two-factor-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(value) => setCode(value)}
                disabled={isLoading}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !isLoading &&
                    code.trim().length === 6
                  ) {
                    handleDisable()
                  }
                }}
                autoFocus
              >
                <InputOTPGroup className="gap-2">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <InputOTPSlot key={index} index={index} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setStep("password")}
                disabled={isLoading}
              >
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={handleDisable}
                disabled={isLoading || code.trim().length !== 6}
              >
                {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
                Disable
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
