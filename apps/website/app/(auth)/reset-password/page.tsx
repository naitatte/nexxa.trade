import { ResetPasswordForm } from "@/components/features/auth/password/reset-password-form"
import { generateNoIndexMetadata } from "@/lib/metadata"
import { Suspense } from "react"

export const metadata = generateNoIndexMetadata({
  title: "Reset password",
  description: "Set a new password for your NexxaTrade account.",
})

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
          <div className="w-full max-w-sm">
            <div className="animate-pulse">Loading...</div>
          </div>
        </div>
      }
    >
      <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">
          <ResetPasswordForm />
        </div>
      </div>
    </Suspense>
  )
}
