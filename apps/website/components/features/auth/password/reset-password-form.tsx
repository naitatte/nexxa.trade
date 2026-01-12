"use client"

import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect } from "react"
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
import { useResetPassword } from "@/lib/api/default/default"
import { toast } from "sonner"
import { translateErrorFromResponse, extractErrorCode } from "@/lib/error-translations"

const resetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>

export function ResetPasswordForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const { setError: setErrorState } = useErrorState({ showToast: false })
  const { state: loadingState, setLoading, setIdle } = useLoadingState()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  })

  const resetPasswordMutation = useResetPassword({
    mutation: {
      onMutate: () => {
        setLoading("Resetting password...")
      },
      onSuccess: () => {
        setIdle()
        toast.success("Password reset successfully!")
        router.push("/login")
      },
      onError: (error) => {
        setIdle()
        const translation = translateErrorFromResponse(error, "Failed to reset password")
        const errorCode = extractErrorCode(error)
        
        toast.error(translation.message, {
          description: translation.description,
        })
        
        const errorObj = error instanceof Error ? error : new Error(String(error))
        setErrorState(errorObj, translation.message, errorCode || undefined, false)
      },
    },
  })

  useEffect(() => {
    const error = searchParams.get("error")
    if (error === "INVALID_TOKEN") {
      toast.error("Invalid or expired reset token")
      router.push("/forgot-password")
    } else if (!token && !error) {
      toast.error("Invalid or missing reset token")
      router.push("/forgot-password")
    }
  }, [token, searchParams, router])

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) {
      toast.error("Invalid or missing reset token")
      return
    }

    resetPasswordMutation.mutate({
      data: {
        newPassword: data.password,
        token,
      },
    })
  }

  if (!token) {
    return null
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>
            Enter your new password below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="password">New Password</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your new password"
                  {...register("password")}
                  aria-invalid={!!errors.password}
                />
                <FieldError errors={errors.password ? [{ message: errors.password.message }] : undefined} />
              </Field>
              <Field>
                <FieldLabel htmlFor="confirm-password">Confirm Password</FieldLabel>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirm your new password"
                  {...register("confirmPassword")}
                  aria-invalid={!!errors.confirmPassword}
                />
                <FieldError errors={errors.confirmPassword ? [{ message: errors.confirmPassword.message }] : undefined} />
              </Field>
              <Field>
                <Button type="submit" disabled={resetPasswordMutation.isPending || loadingState === "loading"}>
                  {(resetPasswordMutation.isPending || loadingState === "loading") && <LoadingSpinner size="sm" />}
                  Reset Password
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
