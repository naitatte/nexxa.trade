"use client"

import { VerifyEmailForm } from "@/components/features/auth/verification/verify-email-form"
import { useSearchParams } from "next/navigation"
import { Suspense, useEffect } from "react"
import { getGetVerifyEmailQueryKey, useGetVerifyEmail } from "@/lib/api/default/default"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

function VerifyEmailPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const email = searchParams.get("email") || undefined
  const token = searchParams.get("token")

  const { isSuccess, isError } = useGetVerifyEmail(
    { token: token || "" },
    {
      query: {
        queryKey: getGetVerifyEmailQueryKey({ token: token || "" }),
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
        <VerifyEmailForm email={email} />
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={
      <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">
          <div className="animate-pulse">Loading...</div>
        </div>
      </div>
    }>
      <VerifyEmailPageContent />
    </Suspense>
  )
}
