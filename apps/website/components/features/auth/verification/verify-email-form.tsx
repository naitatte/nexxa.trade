"use client"

import React from "react"
import Link from "next/link"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FieldDescription } from "@/components/ui/field"
import { useErrorState } from "@/lib/error-state/hooks"
import { useLoadingState } from "@/lib/loading-state/hooks"
import { LoadingSpinner } from "@/lib/loading-state/components"
import { useSendVerificationEmail } from "@/lib/api/auth/auth"
import { translateErrorFromResponse, extractErrorCode } from "@/lib/error-translations"

export function VerifyEmailForm({
  className,
  email: initialEmail,
  ...props
}: React.ComponentProps<"div"> & { email?: string }) {
  const { setError: setErrorState } = useErrorState({ showToast: false })
  const { state: loadingState, setLoading, setIdle, setSuccess, setError } = useLoadingState()

  const sendVerificationEmailMutation = useSendVerificationEmail({
    mutation: {
      onMutate: () => {
        setLoading("Sending...")
      },
      onSuccess: () => {
        setIdle()
        setSuccess("Verification email sent!")
      },
      onError: (error) => {
        setIdle()
        const translation = translateErrorFromResponse(error, "Failed to send verification email")
        const errorCode = extractErrorCode(error)
        
        const errorObj = error instanceof Error ? error : new Error(String(error))
        setErrorState(errorObj, translation.message, errorCode || undefined, false)
      },
    },
  })

  const handleResend = () => {
    if (!initialEmail) {
      setError("Email address is required", "MISSING_REQUIRED_FIELD")
      return
    }

    sendVerificationEmailMutation.mutate({
      data: {
        email: initialEmail,
        callbackURL: `${window.location.origin}/login`,
      },
    })
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="flex justify-center mb-6">
        <Image
          src="/graphics/logo-light.png"
          alt="Logo"
          width={220}
          height={46}
          className="h-9 w-auto dark:hidden"
          priority
        />
        <Image
          src="/graphics/logo-dark.png"
          alt="Logo"
          width={220}
          height={46}
          className="hidden h-9 w-auto dark:block"
          priority
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground text-center">
              We&apos;ve sent a verification link to <strong>{initialEmail || "your email"}</strong>. Click the link in the email to verify your account. If you don&apos;t see it, check your spam folder.
            </p>
            {initialEmail && (
              <Button
                variant="outline"
                onClick={handleResend}
                disabled={sendVerificationEmailMutation.isPending || loadingState === "loading"}
              >
                {(sendVerificationEmailMutation.isPending || loadingState === "loading") && <LoadingSpinner size="sm" />}
                Resend
              </Button>
            )}
            <FieldDescription className="text-center">
              <Link href="/login" className="underline-offset-4 hover:underline">
                Sign in
              </Link>
            </FieldDescription>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
