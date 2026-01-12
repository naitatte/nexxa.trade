import { ForgotPasswordForm } from "@/components/features/auth/password/forgot-password-form"
import { generateNoIndexMetadata } from "@/lib/metadata"

export const metadata = generateNoIndexMetadata({
  title: "Forgot password",
  description: "Reset your NexxaTrade account password.",
})

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <ForgotPasswordForm />
      </div>
    </div>
  )
}
