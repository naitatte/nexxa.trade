"use client"

import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table"
import type { VariantProps } from "class-variance-authority"
import { Badge, badgeVariants } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { DataTable } from "@/components/ui/data-table"
import { DataTablePagination } from "@/components/ui/data-table-pagination"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Check, ChevronDown, Filter, Search, X } from "lucide-react"

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"]

export type OrganizationMember = {
  readonly id: string
  readonly level: 2 | 3 | 4 | 5 | 6 | 7
  readonly name: string
  readonly username?: string | null
  readonly email: string
  readonly status: "active" | "inactive"
  readonly joined: string
  readonly earnedUsdCents: number
}

type OrganizationTableProps = {
  readonly members: OrganizationMember[]
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

const formatUsdt = (value: number): string => {
  const amount = Number.isFinite(value) ? value / 100 : 0
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)} USDT`
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

const LEVELS = [2, 3, 4, 5, 6, 7] as const

export function OrganizationTable({ members }: OrganizationTableProps) {
  const [search, setSearch] = React.useState("")
  const [levelFilter, setLevelFilter] = React.useState<string>("all")
  const [statusFilter, setStatusFilter] = React.useState<string>("all")
  const columns = React.useMemo<ColumnDef<OrganizationMember>[]>(
    () => [
      {
        accessorKey: "level",
        header: "Level",
        cell: ({ row }) => (
          <Badge variant="outline" className="font-medium">
            {row.original.level}
          </Badge>
        ),
      },
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

  const filteredData = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    return members.filter((member) => {
      const levelMatch =
        levelFilter === "all" || String(member.level) === levelFilter
      const statusMatch =
        statusFilter === "all" || member.status === statusFilter
      const searchMatch =
        !q ||
        member.name.toLowerCase().includes(q) ||
        (member.username ?? "").toLowerCase().includes(q) ||
        member.email.toLowerCase().includes(q)
      return levelMatch && statusMatch && searchMatch
    })
  }, [members, levelFilter, statusFilter, search])

  const activeFiltersCount =
    (levelFilter !== "all" ? 1 : 0) + (statusFilter !== "all" ? 1 : 0)

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, username, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "gap-2",
                activeFiltersCount > 0 && "border-primary bg-primary/10 text-primary"
              )}
            >
              <Filter className="size-4" />
              Filters
              <ChevronDown className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[400px] p-0">
            <div className="px-4 py-3">
              <h3 className="font-semibold text-sm">Quick filters</h3>
            </div>
            <DropdownMenuSeparator />
            <div className="p-4 grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Level</label>
                <Select value={levelFilter} onValueChange={setLevelFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All levels" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="all">All levels</SelectItem>
                    {LEVELS.map((level) => (
                      <SelectItem key={level} value={String(level)}>
                        Level {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <DataTable columns={columns} data={filteredData} table={table} />
      <DataTablePagination table={table} />
    </section>
  )
}
