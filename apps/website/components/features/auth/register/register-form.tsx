"use client"

import React from "react"
import Link from "next/link"
import Image from "next/image"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
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
import { useSignUpWithEmailAndPassword, usePostApiAuthIsUsernameAvailable } from "@/lib/api/auth/auth"
import { translateErrorFromResponse, extractErrorCode } from "@/lib/error-translations"

const usernamePattern = /^[a-zA-Z0-9_.]+$/

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be 30 characters or less")
    .regex(usernamePattern, "Username can only use letters, numbers, underscores, and dots"),
  email: z.string().email("Please enter a valid email address"),
  confirmEmail: z.string(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
}).refine((data) => data.email === data.confirmEmail, {
  message: "Emails don't match",
  path: ["confirmEmail"],
})

type RegisterFormData = z.infer<typeof registerSchema>

export function RegisterForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const { setError: setErrorState } = useErrorState({ showToast: false })
  const { state: loadingState, setLoading, setIdle, setSuccess } = useLoadingState()
  const [usernameAvailability, setUsernameAvailability] = useState<"checking" | "available" | "unavailable" | null>(null)
  const [debounceTimeout, setDebounceTimeout] = useState<NodeJS.Timeout | null>(null)
  const [lastCheckedUsername, setLastCheckedUsername] = useState("")

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    clearErrors,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  const handleUsernameCheckSuccess = useCallback(() => {
    setUsernameAvailability("available")
    clearErrors("username")
  }, [clearErrors])

  const handleUsernameCheckError = useCallback((error: unknown) => {
    const status = typeof error === "object" && error !== null && "status" in error
      ? (error as { status?: number }).status
      : undefined
    if (status === 400 || status === 422) {
      setUsernameAvailability("unavailable")
      setError("username", {
        type: "manual",
        message: "This username is already taken",
      })
    } else {
      setUsernameAvailability(null)
    }
  }, [setError])

  const { mutate: checkUsername } = usePostApiAuthIsUsernameAvailable({
    mutation: {
      onSuccess: handleUsernameCheckSuccess,
      onError: handleUsernameCheckError,
    },
  })

  const handleUsernameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value
    if (debounceTimeout) {
      clearTimeout(debounceTimeout)
    }

    if (!nextValue || nextValue.length < 3 || !usernamePattern.test(nextValue)) {
      setUsernameAvailability(null)
      setLastCheckedUsername("")
      return
    }

    if (lastCheckedUsername === nextValue) {
      return
    }

    setUsernameAvailability("checking")
    const timeoutId = setTimeout(() => {
      setLastCheckedUsername(nextValue)
      checkUsername({
        data: {
          username: nextValue,
        },
      })
    }, 500)
    setDebounceTimeout(timeoutId)
  }, [checkUsername, debounceTimeout, lastCheckedUsername])

  useEffect(() => {
    return () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout)
      }
    }
  }, [debounceTimeout])

  const signUpMutation = useSignUpWithEmailAndPassword({
    mutation: {
      onMutate: () => {
        setLoading("Creating account...")
      },
      onSuccess: (_, variables) => {
        setIdle()
        setSuccess("Account created successfully!")
        router.push(`/verify-email?email=${encodeURIComponent(variables.data.email)}`)
      },
      onError: (error) => {
        setIdle()
        const translation = translateErrorFromResponse(error, "Failed to create account")
        const errorCode = extractErrorCode(error)
        
        const errorObj = error instanceof Error ? error : new Error(String(error))
        setErrorState(errorObj, translation.message, errorCode || undefined, false)
      },
    },
  })

  const onSubmit = async (data: RegisterFormData) => {
    if (usernameAvailability !== "available") {
      setError("username", {
        type: "manual",
        message: "Please ensure the username is available before submitting",
      })
      return
    }

    signUpMutation.mutate({
      data: {
        email: data.email,
        password: data.password,
        name: data.name,
        username: data.username,
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
          <CardTitle>Create an account</CardTitle>
          <CardDescription>
            Enter your information below to create your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)}>
            <FieldGroup>
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="name">Name</FieldLabel>
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    {...register("name")}
                    aria-invalid={!!errors.name}
                  />
                  <FieldError errors={errors.name ? [{ message: errors.name.message }] : undefined} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="username">Username</FieldLabel>
                  <div className="relative">
                    <Input
                      id="username"
                      type="text"
                      placeholder="john.doe"
                      {...register("username", { onChange: handleUsernameChange })}
                      aria-invalid={!!errors.username}
                      className={cn(
                        usernameAvailability === "available" && "border-green-500",
                        usernameAvailability === "unavailable" && "border-red-500",
                        usernameAvailability === "checking" && "border-yellow-500"
                      )}
                    />
                    {usernameAvailability === "checking" && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <LoadingSpinner size="sm" />
                      </div>
                    )}
                    {usernameAvailability === "available" && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="h-5 w-5"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    )}
                    {usernameAvailability === "unavailable" && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="h-5 w-5"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                  <FieldError errors={errors.username ? [{ message: errors.username.message }] : undefined} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
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
                  <FieldLabel htmlFor="confirm-email">Confirm Email</FieldLabel>
                  <Input
                    id="confirm-email"
                    type="email"
                    placeholder="m@example.com"
                    {...register("confirmEmail")}
                    aria-invalid={!!errors.confirmEmail}
                    onPaste={(e) => {
                      e.preventDefault()
                      return false
                    }}
                    onCopy={(e) => {
                      e.preventDefault()
                      return false
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      return false
                    }}
                  />
                  <FieldError errors={errors.confirmEmail ? [{ message: errors.confirmEmail.message }] : undefined} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <Input
                    id="password"
                    type="password"
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
                    {...register("confirmPassword")}
                    aria-invalid={!!errors.confirmPassword}
                  />
                  <FieldError errors={errors.confirmPassword ? [{ message: errors.confirmPassword.message }] : undefined} />
                </Field>
              </div>
              <Field>
                <Button type="submit" disabled={signUpMutation.isPending || loadingState === "loading"}>
                  {(signUpMutation.isPending || loadingState === "loading") && <LoadingSpinner size="sm" />}
                  Create account
                </Button>
                <FieldDescription className="text-center">
                  Already have an account?{" "}
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
