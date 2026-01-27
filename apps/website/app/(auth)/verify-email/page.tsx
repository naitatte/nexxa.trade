"use client"

import { VerifyEmailForm } from "@/components/features/auth/verification/verify-email-form"
import { Suspense, useEffect } from "react"
import { getGetApiAuthVerifyEmailQueryKey, useGetApiAuthVerifyEmail } from "@/lib/api/auth/auth"
import { toast } from "sonner"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LoadingSpinner } from "@/lib/loading-state/components"

function VerifyEmailPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const email = searchParams.get("email") || undefined
  const token = searchParams.get("token")

  const { isSuccess, isError } = useGetApiAuthVerifyEmail(
    { token: token || "" },
    {
      query: {
        queryKey: getGetApiAuthVerifyEmailQueryKey({ token: token || "" }),
        enabled: !!token,
        retry: false,
      },
    }
  )

  useEffect(() => {
    if (isSuccess && token) {
      toast.success("Email verified successfully!")
      router.push("/login")
    }
  }, [isSuccess, token, router])

  useEffect(() => {
    if (isError && token) {
      toast.error("Failed to verify email. The link may be invalid or expired.")
    }
  }, [isError, token])

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        {token ? (
          <div className="flex flex-col gap-6">
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
                <CardTitle>Verifying your email</CardTitle>
                <CardDescription>
                  Please wait while we verify your email address...
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center py-4">
                  <LoadingSpinner />
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <VerifyEmailForm email={email} />
        )}
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={
      <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">
          <div className="flex flex-col gap-6">
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
                <CardTitle>Loading</CardTitle>
                <CardDescription>
                  Please wait...
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center py-4">
                  <LoadingSpinner />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    }>
      <VerifyEmailPageContent />
    </Suspense>
  )
}
