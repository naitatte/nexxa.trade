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
import { Input } from "@/components/ui/input"
import { DataTable } from "@/components/ui/data-table"
import { DataTablePagination } from "@/components/ui/data-table-pagination"
import { Check, Search, X } from "lucide-react"

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"]

export type DirectPartner = {
  readonly id: string
  readonly name: string
  readonly username?: string | null
  readonly email: string
  readonly status: "active" | "inactive"
  readonly joined: string
  readonly earnedUsdCents: number
}

type DirectPartnersTableProps = {
  readonly partners: DirectPartner[]
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

const StatusBadge = ({ status }: { readonly status: string }) => {
  const isActive = status === "active"
  return (
    <Badge variant={statusVariant(status)} className="gap-1 font-medium">
      {isActive ? <Check className="size-3" /> : <X className="size-3" />}
      {isActive ? "Active" : "Inactive"}
    </Badge>
  )
}

const formatUsdt = (value: number): string => {
  const amount = Number.isFinite(value) ? value / 100 : 0
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)} USDT`
}

export function DirectPartnersTable({ partners }: DirectPartnersTableProps) {
  const [search, setSearch] = React.useState("")
  const filteredPartners = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return partners
    return partners.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.username ?? "").toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        formatDate(p.joined).toLowerCase().includes(q)
    )
  }, [partners, search])
  const columns = React.useMemo<ColumnDef<DirectPartner>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Partner",
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <span className="font-medium">{row.original.name}</span>
            {row.original.username ? (
              <div className="text-xs text-muted-foreground">@{row.original.username}</div>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.email}</span>
        ),
      },
      {
        accessorKey: "earnedUsdCents",
        header: "Earned",
        cell: ({ row }) => (
          <span className="tabular-nums font-medium text-foreground">
            {formatUsdt(row.original.earnedUsdCents)}
          </span>
        ),
      },
      {
        accessorKey: "joined",
        header: "Joined",
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {formatDate(row.original.joined)}
          </span>
        ),
      },
    ],
    []
  )

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredPartners,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  return (
    <section className="space-y-4">
      <div className="relative w-72">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search name, username, or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      <DataTable columns={columns} data={filteredPartners} table={table} />
      <DataTablePagination table={table} />
    </section>
  )
}
