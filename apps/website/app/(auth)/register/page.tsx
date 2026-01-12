import { RegisterForm } from "@/components/features/auth/register/register-form"
import { generateNoIndexMetadata } from "@/lib/metadata"

export const metadata = generateNoIndexMetadata({
  title: "Register",
  description: "Create your NexxaTrade account to start receiving premium trading signals.",
})

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <RegisterForm />
      </div>
    </div>
  )
}
