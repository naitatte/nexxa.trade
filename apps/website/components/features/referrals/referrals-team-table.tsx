"use client"

import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table"
import type { VariantProps } from "class-variance-authority"
import { Badge, badgeVariants } from "@/components/ui/badge"
import { DataTable } from "@/components/ui/data-table"
import { DataTablePagination } from "@/components/ui/data-table-pagination"

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"]

export type ReferralTeamMember = {
  id: string
  name: string
  username: string | null
  email: string
  membershipStatus: string
  joinedAt: string
  level: number
}

type ReferralsTeamTableProps = {
  readonly members: ReferralTeamMember[]
  readonly total: number
}

const formatDate = (value: string | null | undefined): string => {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date)
}

const statusVariant = (status: string): BadgeVariant => {
  switch (status) {
    case "active":
      return "default"
    case "inactive":
      return "destructive"
    default:
      return "outline"
  }
}

const statusLabel = (status: string): string =>
  status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())

const levelLabel = (level: number): string => {
  if (level === 1) return "Direct"
  return `Level ${level}`
}

export function ReferralsTeamTable({ members, total }: ReferralsTeamTableProps) {
  const columns = React.useMemo<ColumnDef<ReferralTeamMember>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.name}</span>
            {row.original.username && (
              <span className="text-xs text-muted-foreground">@{row.original.username}</span>
            )}
          </div>
        ),
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.email}</span>
        ),
      },
      {
        accessorKey: "level",
        header: "Level",
        cell: ({ row }) => (
          <Badge variant="outline" className="font-medium">
            {levelLabel(row.original.level)}
          </Badge>
        ),
      },
      {
        accessorKey: "membershipStatus",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={statusVariant(row.original.membershipStatus)} className="font-medium">
            {statusLabel(row.original.membershipStatus)}
          </Badge>
        ),
      },
      {
        accessorKey: "joinedAt",
        header: "Joined",
        cell: ({ row }) => (
          <span className="text-muted-foreground">{formatDate(row.original.joinedAt)}</span>
        ),
      },
    ],
    []
  )

  const table = useReactTable({
    data: members,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  return (
    <section className="space-y-4">
      <DataTable columns={columns} data={members} table={table} />
      <DataTablePagination table={table} />
    </section>
  )
}
