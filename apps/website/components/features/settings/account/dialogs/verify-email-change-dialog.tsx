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
import { useSession } from "@/lib/auth/hooks"
import { usePostApiAuthVerifyChangeEmailOtp } from "@/lib/api/auth/auth"
import { useLoadingState } from "@/lib/loading-state/hooks"
import { translateErrorFromResponse } from "@/lib/error-translations"

type VerifyEmailChangeDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  newEmail: string
  onSuccess?: () => void
}

export function VerifyEmailChangeDialog({
  open,
  onOpenChange,
  newEmail,
  onSuccess,
}: VerifyEmailChangeDialogProps) {
  const [otpCode, setOtpCode] = useState("")
  const queryClient = useQueryClient()
  const { refetch: refetchSession } = useSession()
  const { isLoading, setLoading, setSuccess, setError, setIdle } = useLoadingState()

  const verifyOtpMutation = usePostApiAuthVerifyChangeEmailOtp({
    mutation: {
      onSuccess: async () => {
        setSuccess("Email changed successfully!")
        queryClient.invalidateQueries({ queryKey: ["/api/auth/get-session"] })
        await refetchSession()
        setOtpCode("")
        setIdle()
        onOpenChange(false)
        await onSuccess?.()
      },
      onError: (error: unknown) => {
        const errorTranslation = translateErrorFromResponse(
          error,
          "The code is invalid or has expired"
        )
        setError(errorTranslation.message, errorTranslation.message)
        setIdle()
      },
    },
  })

  const handleVerify = () => {
    if (!otpCode.trim()) {
      setError("Please enter the verification code", "MISSING_REQUIRED_FIELD")
      return
    }

    if (otpCode.trim().length !== 6) {
      setError("The code must be 6 digits", "INVALID_INPUT")
      return
    }

    setLoading("Verifying email...")
    verifyOtpMutation.mutate({
      data: {
        newEmail,
        otpCode: otpCode.trim(),
      },
    })
  }

  const handleClose = () => {
    if (!verifyOtpMutation.isPending) {
      setOtpCode("")
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle>Verify email</DialogTitle>
          <DialogDescription>
            Enter the code sent to <strong>{newEmail}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 flex justify-center">
          <InputOTP
            id="verification-code"
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={otpCode}
            onChange={(value) => setOtpCode(value)}
            disabled={verifyOtpMutation.isPending}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !verifyOtpMutation.isPending &&
                otpCode.length === 6
              ) {
                handleVerify()
              }
            }}
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
            onClick={handleClose}
            disabled={isLoading || verifyOtpMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleVerify}
            disabled={isLoading || verifyOtpMutation.isPending || otpCode.length !== 6}
          >
            {(isLoading || verifyOtpMutation.isPending) && <Loader2 className="mr-2 size-4 animate-spin" />}
            Verify
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
