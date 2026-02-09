"use client"

import { useState } from "react"
import {
  Copy,
  Check,
  Users,
  UserCheck,
  UsersRound,
  AlertTriangle,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTabsStore } from "@/lib/stores/ui/tabs-store"
import {
  ReferralsTeamTable,
  type ReferralTeamMember,
} from "@/components/features/referrals/referrals-team-table"

type ReferralStats = {
  directPartners: number
  totalTeam: number
  activeMembers: number
  atRiskMembers: number
}

type ReferralsContentProps = {
  readonly user: {
    id: string
    name: string
    username: string | null
    email: string
  }
  readonly stats: ReferralStats
  readonly team: {
    items: ReferralTeamMember[]
    total: number
  }
  readonly atRiskTeam: {
    items: ReferralTeamMember[]
    total: number
  }
}

function StatCard({
  title,
  value,
  icon: Icon,
  onClick,
  clickable = false,
}: {
  readonly title: string
  readonly value: number
  readonly icon: React.ElementType
  readonly onClick?: () => void
  readonly clickable?: boolean
}) {
  const Wrapper = clickable ? "button" : "div"
  return (
    <Card className={clickable ? "cursor-pointer transition-colors hover:border-primary/50" : ""}>
      <Wrapper onClick={onClick} className="w-full text-left">
        <CardContent className="flex items-center gap-4 px-6 py-5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Icon className="size-5 text-muted-foreground" />
          </div>
          <div className="space-y-0.5">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-semibold tabular-nums">{value}</p>
          </div>
        </CardContent>
      </Wrapper>
    </Card>
  )
}

export function ReferralsContent({ user, stats, team, atRiskTeam }: ReferralsContentProps) {
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const activeTab = useTabsStore((state) => state.activeTabs.referrals ?? "team")
  const setActiveTab = useTabsStore((state) => state.setActiveTab)

  const referralCode = user.username || user.email.split("@")[0]
  const referralLink = typeof window !== "undefined"
    ? `${window.location.origin}/signup?ref=${referralCode}`
    : ""

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(referralCode)
      setCopiedCode(true)
      toast.success("Code copied")
      setTimeout(() => setCopiedCode(false), 2000)
    } catch {
      toast.error("Failed to copy code")
    }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink)
      setCopiedLink(true)
      toast.success("Link copied")
      setTimeout(() => setCopiedLink(false), 2000)
    } catch {
      toast.error("Failed to copy link")
    }
  }

  const handleAtRiskClick = () => {
    setActiveTab("referrals", "at-risk")
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Direct partners"
          value={stats.directPartners}
          icon={Users}
        />
        <StatCard
          title="Total team"
          value={stats.totalTeam}
          icon={UsersRound}
        />
        <StatCard
          title="Active members"
          value={stats.activeMembers}
          icon={UserCheck}
        />
        <StatCard
          title="At risk"
          value={stats.atRiskMembers}
          icon={AlertTriangle}
          onClick={handleAtRiskClick}
          clickable
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Referral information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Referral code</label>
              <div className="flex gap-2">
                <Input
                  value={referralCode}
                  readOnly
                  className="font-mono"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyCode}
                  disabled={copiedCode}
                >
                  {copiedCode ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="space-y-2 lg:col-span-2">
              <label className="text-sm font-medium">Referral link</label>
              <div className="flex gap-2">
                <Input
                  value={referralLink}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyLink}
                  disabled={copiedLink}
                >
                  {copiedLink ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab("referrals", value)}
        className="w-full"
      >
        <TabsList variant="line" className="mb-6">
          <TabsTrigger variant="line" value="team">Team</TabsTrigger>
          <TabsTrigger variant="line" value="at-risk">
            At risk
            {stats.atRiskMembers > 0 && (
              <span className="ml-1.5 inline-flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground">
                {stats.atRiskMembers}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="team">
          <ReferralsTeamTable members={team.items} total={team.total} />
        </TabsContent>

        <TabsContent value="at-risk">
          <ReferralsTeamTable members={atRiskTeam.items} total={atRiskTeam.total} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
