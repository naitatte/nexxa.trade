import { LoginForm } from "@/components/features/auth/login/login-form"
import { generatePageMetadata } from "@/lib/metadata"

export const metadata = generatePageMetadata({
  title: "Login",
  description: "Sign in to your NexxaTrade account to access premium trading signals and market insights.",
  url: "/",
})

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  )
}
