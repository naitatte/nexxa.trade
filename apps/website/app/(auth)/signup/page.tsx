import { RegisterForm } from "@/components/features/auth/register/register-form"
import { generateNoIndexMetadata } from "@/lib/metadata"

export const metadata = generateNoIndexMetadata({
  title: "Sign Up",
  description: "Create your NexxaTrade account to start receiving premium trading signals.",
})

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ ref?: string }>
}) {
  const params = await searchParams
  const refCode =
    typeof params?.ref === "string" ? params.ref : undefined

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <RegisterForm defaultRefCode={refCode} />
      </div>
    </div>
  )
}
