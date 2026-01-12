import { generateNoIndexMetadata } from "@/lib/metadata"

export const metadata = generateNoIndexMetadata({
  title: "Verify email",
  description: "Verify your email address to complete your NexxaTrade account registration.",
})

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
