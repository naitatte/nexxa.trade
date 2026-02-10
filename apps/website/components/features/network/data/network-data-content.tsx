"use client"

import { useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTabsStore } from "@/lib/stores/ui/tabs-store"
import { DirectPartnersTable } from "@/components/features/network/data/direct-partners-table"
import type { DirectPartner } from "@/components/features/network/data/direct-partners-table"
import { OrganizationTable } from "@/components/features/network/data/organization-table"
import type { OrganizationMember } from "@/components/features/network/data/organization-table"
import { Spinner } from "@/components/ui/spinner"
import { useGetApiReferralsStats, useGetApiReferralsTeam } from "@/lib/api/referrals/referrals"
import { Users, UserCheck, Network, AlertTriangle } from "lucide-react"

function StatCard({
  title,
  value,
  icon: Icon,
}: {
  readonly title: string
  readonly value: number | string
  readonly icon: React.ElementType
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-4 px-6 py-5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="size-5 text-muted-foreground" />
        </div>
        <div className="space-y-0.5">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export function NetworkDataContent() {
  const activeTab = useTabsStore((state) => state.activeTabs.networkData ?? "direct-partners")
  const setActiveTab = useTabsStore((state) => state.setActiveTab)

  const statsQuery = useGetApiReferralsStats({
    query: { staleTime: 60_000 },
  })

  const teamQuery = useGetApiReferralsTeam(
    { page: 1, pageSize: 100 },
    { query: { staleTime: 60_000 } }
  )

  const teamMembers = useMemo(() => teamQuery.data?.items ?? [], [teamQuery.data?.items])

  const { directPartners, organizationMembers } = useMemo(() => {
    const direct: DirectPartner[] = []
    const organization: OrganizationMember[] = []

    teamMembers.forEach((member) => {
      const status: "active" | "inactive" = member.membershipStatus === "active" ? "active" : "inactive"
      if (member.level === 1) {
        direct.push({
          id: member.id,
          name: member.name,
          username: member.username ?? null,
          email: member.email,
          status,
          joined: member.joinedAt,
          earnedUsdCents: member.totalEarnedUsdCents ?? 0,
        })
        return
      }

      if (member.level >= 2 && member.level <= 7) {
        organization.push({
          id: member.id,
          level: member.level as OrganizationMember["level"],
          name: member.name,
          username: member.username ?? null,
          email: member.email,
          status,
          joined: member.joinedAt,
          earnedUsdCents: member.totalEarnedUsdCents ?? 0,
        })
      }
    })

    return { directPartners: direct, organizationMembers: organization }
  }, [teamMembers])

  const stats = statsQuery.data
  const statsUnavailable = !stats && (statsQuery.isLoading || statsQuery.isError)
  const formatStat = (value?: number) => (statsUnavailable ? "—" : value ?? 0)

  const totalNetwork = formatStat(stats?.totalTeam)
  const directCount = formatStat(stats?.directPartners)
  const totalActive = formatStat(stats?.activeMembers)
  const atRiskMembers = formatStat(stats?.atRiskMembers)

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total network"
          value={totalNetwork}
          icon={Network}
        />
        <StatCard
          title="Direct partners"
          value={directCount}
          icon={Users}
        />
        <StatCard
          title="Active members"
          value={totalActive}
          icon={UserCheck}
        />
        <StatCard
          title="At-risk members"
          value={atRiskMembers}
          icon={AlertTriangle}
        />
      </div>
      {statsQuery.isError ? (
        <p className="text-sm text-destructive">Unable to load network stats right now.</p>
      ) : null}

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab("networkData", value)}
        className="w-full"
      >
        <TabsList variant="line" className="mb-6">
          <TabsTrigger variant="line" value="direct-partners">
            Direct partners (Level 1)
          </TabsTrigger>
          <TabsTrigger variant="line" value="organization">
            Organization (Levels 2–7)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="direct-partners">
          {teamQuery.isLoading && !teamMembers.length ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              Loading direct partners...
            </div>
          ) : teamQuery.isError ? (
            <p className="text-sm text-destructive">Unable to load direct partners right now.</p>
          ) : (
            <DirectPartnersTable partners={directPartners} />
          )}
        </TabsContent>

        <TabsContent value="organization">
          {teamQuery.isLoading && !teamMembers.length ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              Loading organization members...
            </div>
          ) : teamQuery.isError ? (
            <p className="text-sm text-destructive">Unable to load organization members right now.</p>
          ) : (
            <OrganizationTable members={organizationMembers} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
