"use client"

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
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useErrorState } from "@/lib/error-state/hooks"
import { useLoadingState } from "@/lib/loading-state/hooks"
import { LoadingSpinner } from "@/lib/loading-state/components"
import { useSignInEmail } from "@/lib/api/default/default"
import { toast } from "sonner"
import { translateErrorFromResponse, extractErrorCode } from "@/lib/error-translations"

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  rememberMe: z.boolean().default(false),
})

type LoginFormData = z.input<typeof loginSchema>

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { setError: setErrorState } = useErrorState({ showToast: false })
  const { state: loadingState, setLoading, setIdle } = useLoadingState()

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

  const signInMutation = useSignInEmail({
    mutation: {
      onMutate: () => {
        setLoading("Signing in...")
      },
      onSuccess: async () => {
        setIdle()
        toast.success("Successfully signed in!")
        await new Promise((resolve) => setTimeout(resolve, 500))
        window.location.href = "/dashboard"
      },
      onError: (error) => {
        setIdle()
        const translation = translateErrorFromResponse(error, "Failed to sign in")
        const errorCode = extractErrorCode(error)
        
        toast.error(translation.message, {
          description: translation.description,
        })
        
        const errorObj = error instanceof Error ? error : new Error(String(error))
        setErrorState(errorObj, translation.message, errorCode || undefined, false)
      },
    },
  })

  const onSubmit = async (data: LoginFormData) => {
    const rememberMe = data.rememberMe ?? false
    signInMutation.mutate({
      data: {
        email: data.email,
        password: data.password,
        rememberMe: rememberMe ? "true" : undefined,
      },
    })
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Login to your account</CardTitle>
          <CardDescription>
            Enter your email below to login to your account
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
                <Button type="submit" disabled={signInMutation.isPending || loadingState === "loading"}>
                  {(signInMutation.isPending || loadingState === "loading") && <LoadingSpinner size="sm" />}
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
  )
}
