import { ResetPasswordForm } from "@/components/features/auth/password/reset-password-form"
import { generateNoIndexMetadata } from "@/lib/metadata"

export const metadata = generateNoIndexMetadata({
  title: "Reset password",
  description: "Set a new password for your NexxaTrade account.",
})

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <ResetPasswordForm />
      </div>
    </div>
  )
}
