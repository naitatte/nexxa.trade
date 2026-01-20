"use client"

import React from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useErrorState } from "@/lib/error-state/hooks"
import { useLoadingState } from "@/lib/loading-state/hooks"
import { LoadingSpinner } from "@/lib/loading-state/components"
import { useRequestPasswordReset } from "@/lib/api/auth/auth"
import { toast } from "sonner"
import { translateErrorFromResponse, extractErrorCode } from "@/lib/error-translations"

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
})

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { setError: setErrorState } = useErrorState({ showToast: false })
  const { state: loadingState, setLoading, setIdle, setSuccess } = useLoadingState()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  const requestPasswordResetMutation = useRequestPasswordReset({
    mutation: {
      onMutate: () => {
        setLoading("Sending reset link...")
      },
      onSuccess: () => {
        setIdle()
        setSuccess("Reset link sent! Please check your email.")
      },
      onError: (error) => {
        setIdle()
        const translation = translateErrorFromResponse(error, "Failed to send reset link")
        const errorCode = extractErrorCode(error)
        
        toast.error(translation.message, {
          description: translation.description,
        })
        
        const errorObj = error instanceof Error ? error : new Error(String(error))
        setErrorState(errorObj, translation.message, errorCode || undefined, false)
      },
    },
  })

  const onSubmit = async (data: ForgotPasswordFormData) => {
    const redirectTo = `${window.location.origin}/reset-password`
    requestPasswordResetMutation.mutate({
      data: {
        email: data.email,
        redirectTo,
      },
    })
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Forgot your password?</CardTitle>
          <CardDescription>
            Enter your email address and we&apos;ll send you a link to reset your password
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  {...register("email")}
                  aria-invalid={!!errors.email}
                />
                <FieldError errors={errors.email ? [{ message: errors.email.message }] : undefined} />
              </Field>
              <Field>
                <Button type="submit" disabled={requestPasswordResetMutation.isPending || loadingState === "loading" || loadingState === "success"}>
                  {(requestPasswordResetMutation.isPending || loadingState === "loading") && <LoadingSpinner size="sm" />}
                  Send reset link
                </Button>
                <FieldDescription className="text-center">
                  Remember your password?{" "}
                  <Link href="/login" className="underline-offset-4 hover:underline">
                    Sign in
                  </Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
