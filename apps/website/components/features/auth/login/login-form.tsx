"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useLoadingState } from "@/lib/loading-state/hooks"
import { LoadingSpinner } from "@/lib/loading-state/components"
import { usePostApiAuthSignInUsername, useSignInEmail } from "@/lib/api/auth/auth"
import { translateErrorFromResponse } from "@/lib/error-translations"
import { VerifyTwoFactorDialog } from "./dialogs/verify-two-factor-dialog"

const usernamePattern = /^[a-zA-Z0-9_.]+$/

const loginSchema = z.object({
  identifier: z.string().min(3, "Please enter your email or username"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  rememberMe: z.boolean().default(false),
}).superRefine((data, ctx) => {
  const value = data.identifier.trim()
  if (!value) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please enter your email or username",
      path: ["identifier"],
    })
    return
  }

  if (value.includes("@")) {
    const emailCheck = z.string().email().safeParse(value)
    if (!emailCheck.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please enter a valid email address",
        path: ["identifier"],
      })
    }
    return
  }

  if (!usernamePattern.test(value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Usernames can only use letters, numbers, underscores, and dots",
      path: ["identifier"],
    })
  }
})

type LoginFormData = z.input<typeof loginSchema>

const hasTwoFactorRedirect = (value: unknown): boolean => {
  if (!value || typeof value !== "object") return false

  const record = value as Record<string, unknown>
  if (typeof record.twoFactorRedirect === "boolean") {
    return record.twoFactorRedirect
  }

  const data = record.data
  if (data && typeof data === "object") {
    const dataRecord = data as Record<string, unknown>
    if (typeof dataRecord.twoFactorRedirect === "boolean") {
      return dataRecord.twoFactorRedirect
    }
  }

  return false
}

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [showTwoFactorDialog, setShowTwoFactorDialog] = useState(false)
  const { state: loadingState, setLoading, setIdle, setSuccess, setError } = useLoadingState()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      rememberMe: false,
    },
  })

  const handleSignInSuccess = async (response: unknown) => {
    setIdle()
    
    if (hasTwoFactorRedirect(response)) {
      setShowTwoFactorDialog(true)
      return
    }
    
    setSuccess("Successfully signed in!")
    await new Promise((resolve) => setTimeout(resolve, 500))
    window.location.href = "/dashboard"
  }

  const handleSignInError = (error: unknown) => {
    setIdle()
    const translation = translateErrorFromResponse(error, "Failed to sign in")
    setError(translation.message, translation.message)
  }

  const signInEmailMutation = useSignInEmail({
    mutation: {
      onMutate: () => {
        setLoading("Signing in...")
      },
      onSuccess: handleSignInSuccess,
      onError: handleSignInError,
    },
  })

  const signInUsernameMutation = usePostApiAuthSignInUsername({
    mutation: {
      onMutate: () => {
        setLoading("Signing in...")
      },
      onSuccess: handleSignInSuccess,
      onError: handleSignInError,
    },
  })

  const onSubmit = async (data: LoginFormData) => {
    const rememberMe = data.rememberMe ?? false
    const identifier = data.identifier.trim()

    if (identifier.includes("@")) {
      signInEmailMutation.mutate({
        data: {
          email: identifier,
          password: data.password,
          rememberMe: rememberMe ? "true" : undefined,
        },
      })
      return
    }

    signInUsernameMutation.mutate({
      data: {
        username: identifier,
        password: data.password,
        rememberMe: rememberMe ? true : undefined,
      },
    })
  }

  const handleTwoFactorSuccess = async () => {
    await new Promise((resolve) => setTimeout(resolve, 500))
    window.location.href = "/dashboard"
  }

  return (
    <>
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <div className="flex justify-center mb-6">
          <Image
            src="/graphics/logo-light.png"
            alt="Logo"
            width={440}
            height={92}
            className="h-12 w-auto dark:hidden"
            priority
          />
          <Image
            src="/graphics/logo-dark.png"
            alt="Logo"
            width={440}
            height={92}
            className="hidden h-12 w-auto dark:block"
            priority
          />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Login to your account</CardTitle>
          <CardDescription>
              Enter your email or username below to login to your account
          </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)}>
              <FieldGroup>
                <Field>
                <FieldLabel htmlFor="identifier">Email or username</FieldLabel>
                <Input
                  id="identifier"
                  type="text"
                  placeholder="m@example.com or username"
                  {...register("identifier")}
                  aria-invalid={!!errors.identifier}
                />
                <FieldError errors={errors.identifier ? [{ message: errors.identifier.message }] : undefined} />
              </Field>
                <Field>
                  <div className="flex items-center">
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <Link
                      href="/forgot-password"
                      className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                    >
                      Forgot your password?
                    </Link>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    {...register("password")}
                    aria-invalid={!!errors.password}
                  />
                  <FieldError errors={errors.password ? [{ message: errors.password.message }] : undefined} />
                </Field>
                <Field orientation="horizontal">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="remember-me"
                      {...register("rememberMe")}
                    />
                    <Label
                      htmlFor="remember-me"
                      className="text-sm font-normal cursor-pointer"
                    >
                      Remember me
                    </Label>
                  </div>
                </Field>
                <Field>
                  <Button
                    type="submit"
                    disabled={signInEmailMutation.isPending || signInUsernameMutation.isPending || loadingState === "loading"}
                  >
                    {(signInEmailMutation.isPending || signInUsernameMutation.isPending || loadingState === "loading") && <LoadingSpinner size="sm" />}
                    Login
                  </Button>
                  <FieldDescription className="text-center">
                    Don&apos;t have an account?{" "}
                    <Link href="/register" className="underline-offset-4 hover:underline">
                      Sign up
                    </Link>
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>

      <VerifyTwoFactorDialog
        open={showTwoFactorDialog}
        onOpenChange={setShowTwoFactorDialog}
        onSuccess={handleTwoFactorSuccess}
      />
    </>
  )
}
