"use client"

import { VerifyEmailForm } from "@/components/features/auth/verification/verify-email-form"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

function VerifyEmailPageContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get("email") || undefined

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
