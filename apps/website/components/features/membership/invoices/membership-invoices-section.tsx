"use client"

import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table"
import type { VariantProps } from "class-variance-authority"
import { ExternalLink } from "lucide-react"

import { Badge, badgeVariants } from "@/components/ui/badge"
import { DataTable } from "@/components/ui/data-table"
import { DataTablePagination } from "@/components/ui/data-table-pagination"
import type { MembershipInvoice } from "./membership-invoices-table"

type BadgeVariant = VariantProps<typeof badgeVariants>[
  "variant"
]

type MembershipInvoicesSectionProps = {
  invoices: MembershipInvoice[]
  total: number
}

const formatDate = (value: string | null | undefined) => {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date)
}

const formatUsd = (cents: number) => `$${(cents / 100).toFixed(2)}`

const statusLabel = (status: string) => {
  if (status === "failed") return "Expired"
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
}

const formatTier = (tier: string) => {
  const tierMap: Record<string, string> = {
    trial_weekly: "Trial Weekly",
    lifetime: "Lifetime",
  }
  const normalized = tier.toLowerCase()
  return tierMap[normalized] || tier.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
}

const formatChain = (chain: string | null) => {
  if (!chain) return "—"
  const chainMap: Record<string, string> = {
    ethereum: "Ethereum",
    polygon: "Polygon",
    arbitrum: "Arbitrum",
    optimism: "Optimism",
    base: "Base",
    bsc: "Binance Smart Chain",
    avalanche: "Avalanche",
    fantom: "Fantom",
    solana: "Solana",
    bitcoin: "Bitcoin",
  }
  const normalized = chain.toLowerCase().replace(/_/g, " ")
  return chainMap[normalized] || normalized.replace(/\b\w/g, (char) => char.toUpperCase())
}

const statusVariant = (status: string): BadgeVariant => {
  switch (status) {
    case "confirmed":
      return "secondary"
    case "failed":
      return "destructive"
    case "pending":
    default:
      return "outline"
  }
}

const completionBadge = (
  status: string,
  appliedAt: string | null
): { label: string; variant: BadgeVariant } => {
  if (status === "failed") return { label: "Not completed", variant: "destructive" }
  if (status === "confirmed" && appliedAt) {
    return { label: "Completed", variant: "default" }
  }
  return { label: "Processing", variant: "outline" }
}

export function MembershipInvoicesSection({
  invoices,
  total,
}: MembershipInvoicesSectionProps) {
  const columns = React.useMemo<ColumnDef<MembershipInvoice>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: "Date",
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
      {
        accessorKey: "tier",
        header: "Plan",
        cell: ({ row }) => (
          <span className="font-medium">{formatTier(row.original.tier)}</span>
        ),
      },
      {
        accessorKey: "amountUsdCents",
        header: "Amount",
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">
            {formatUsd(row.original.amountUsdCents)}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={statusVariant(row.original.status)} className="font-medium">
            {statusLabel(row.original.status)}
          </Badge>
        ),
      },
      {
        id: "completion",
        header: "Completion",
        cell: ({ row }) => {
          const { label, variant } = completionBadge(
            row.original.status,
            row.original.appliedAt
          )
          return (
            <Badge variant={variant} className="font-medium">
              {label}
            </Badge>
          )
        },
      },
      {
        accessorKey: "chain",
        header: "Chain",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatChain(row.original.chain)}
          </span>
        ),
      },
      {
        accessorKey: "txHash",
        header: "Tx Hash",
        cell: ({ row }) => {
          const hash = row.original.txHash
          if (!hash) {
            return <span className="text-muted-foreground">—</span>
          }
          const short = `${hash.slice(0, 6)}…${hash.slice(-4)}`
          return (
            <a
              href={`https://bscscan.com/tx/${hash}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
              title={hash}
            >
              {short}
              <ExternalLink className="size-3" />
            </a>
          )
        },
      },
    ],
    []
  )

  const table = useReactTable({
    data: invoices,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  return (
    <section className="space-y-4">
      <DataTable columns={columns} data={invoices} table={table} />
      <DataTablePagination table={table} />
    </section>
  )
}
