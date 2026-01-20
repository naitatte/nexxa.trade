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
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { useLoadingState } from "@/lib/loading-state/hooks"
import { translateErrorFromResponse } from "@/lib/error-translations"
import { authClient } from "@/lib/auth/client"
import { useSession } from "@/lib/auth/hooks"

type VerifyTwoFactorDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function VerifyTwoFactorDialog({
  open,
  onOpenChange,
  onSuccess,
}: VerifyTwoFactorDialogProps) {
  const [code, setCode] = useState("")
  const { isLoading, setLoading, setIdle, setSuccess, setError } = useLoadingState()
  const queryClient = useQueryClient()
  const { refetch: refetchSession } = useSession()

  const handleVerify = async () => {
    if (code.trim().length !== 6) {
      setError("Please enter a valid 6-digit code", "INVALID_INPUT")
      return
    }

    setLoading("Verifying code...")
    try {
      await authClient.twoFactor.verifyTotp({
        code: code.trim(),
      })

      queryClient.invalidateQueries({ queryKey: ["/api/auth/get-session"] })
      await refetchSession()
      
      setIdle()
      setSuccess("Successfully signed in!")
      handleClose()
      await onSuccess?.()
    } catch (error: unknown) {
      setIdle()
      const errorTranslation = translateErrorFromResponse(
        error,
        "Invalid code. Please try again."
      )
      setError(errorTranslation.message, errorTranslation.message)
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      setCode("")
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle>Enter authentication code</DialogTitle>
          <DialogDescription>
            Enter the 6-digit code from your authenticator app to complete
            the login.
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
                handleVerify()
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
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleVerify}
            disabled={isLoading || code.trim().length !== 6}
          >
            {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Verify
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
