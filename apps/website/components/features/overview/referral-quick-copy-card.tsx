"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Copy, Check, Link2, ChevronRight } from "lucide-react"
import { toast } from "sonner"

type ReferralQuickCopyCardProps = {
  username: string | null
  email: string
}

export function ReferralQuickCopyCard({ username, email }: ReferralQuickCopyCardProps) {
  const [copied, setCopied] = useState(false)
  const referralCode = username || email.split("@")[0]
  const referralLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/signup?ref=${referralCode}`
      : ""

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink)
      setCopied(true)
      toast.success("Link copied")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Failed to copy link")
    }
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b pb-6">
        <div className="space-y-1.5">
          <CardTitle className="text-sm font-medium">Referral quick copy</CardTitle>
          <CardDescription>Share your referral link to grow your team</CardDescription>
        </div>
        <Link2 className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate font-mono text-sm" title={referralLink}>
              {referralLink || "—"}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={handleCopy}
              disabled={copied}
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        <Link
          href="/referrals"
          className="mt-auto flex items-center gap-1 pt-4 text-sm font-medium text-primary hover:underline"
        >
          View referrals
          <ChevronRight className="h-4 w-4" />
        </Link>
      </CardContent>
    </Card>
  )
}
