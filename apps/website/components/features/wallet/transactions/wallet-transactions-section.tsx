"use client"

import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table"
import type { VariantProps } from "class-variance-authority"
import { ExternalLink, ArrowDownRight, ArrowUpRight } from "lucide-react"

import { Badge, badgeVariants } from "@/components/ui/badge"
import { LoadingInline } from "@/lib/loading-state/components"
import { DataTable } from "@/components/ui/data-table"
import { DataTablePagination } from "@/components/ui/data-table-pagination"
import type { WalletTransaction } from "@/lib/api/wallet/client"

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"]

type WalletTransactionsSectionProps = {
  transactions: WalletTransaction[]
  isLoading?: boolean
}

const formatDate = (value: string | null | undefined) => {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

const formatUsd = (cents: number) => `$${(cents / 100).toFixed(2)}`

const statusLabel = (status: string) => {
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
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

const getExplorerBaseUrl = (chain: string | null) => {
  if (!chain) return null
  const normalized = chain.toLowerCase().replace(/_/g, "")
  const map: Record<string, string> = {
    bsc: "https://bscscan.com",
    binancesmartchain: "https://bscscan.com",
    ethereum: "https://etherscan.io",
    polygon: "https://polygonscan.com",
    arbitrum: "https://arbiscan.io",
    optimism: "https://optimistic.etherscan.io",
    base: "https://basescan.org",
    avalanche: "https://snowtrace.io",
  }
  return map[normalized] ?? null
}

const statusVariant = (status: string): BadgeVariant => {
  switch (status) {
    case "confirmed":
    case "paid":
      return "default"
    case "failed":
    case "rejected":
      return "destructive"
    case "approved":
    case "processing":
    case "pending_admin":
    case "pending":
    default:
      return "outline"
  }
}

const typeLabel = (type: string) => {
  switch (type) {
    case "deposit":
      return "Deposit"
    case "withdrawal":
      return "Withdrawal"
    default:
      return type.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
  }
}

export function WalletTransactionsSection({
  transactions,
  isLoading = false,
}: WalletTransactionsSectionProps) {
  const columns = React.useMemo<ColumnDef<WalletTransaction>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: "Date",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            {row.original.type === "deposit" ? (
              <ArrowDownRight className="h-4 w-4 text-green-600 dark:text-green-400" />
            ) : (
              <ArrowUpRight className="h-4 w-4 text-red-600 dark:text-red-400" />
            )}
            <span className="font-medium">{typeLabel(row.original.type)}</span>
          </div>
        ),
      },
      {
        accessorKey: "amountUsdCents",
        header: "Amount",
        cell: ({ row }) => (
          <span className={`font-medium tabular-nums ${row.original.type === "deposit" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
            {row.original.type === "deposit" ? "+" : "-"}
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
          const explorerBaseUrl = getExplorerBaseUrl(row.original.chain)
          const short = `${hash.slice(0, 6)}…${hash.slice(-4)}`
          if (!explorerBaseUrl) {
            return <span className="font-mono text-xs text-muted-foreground">{short}</span>
          }
          return (
            <a
              href={`${explorerBaseUrl}/tx/${hash}`}
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

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: transactions,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  return (
    <section className="space-y-4">
      {isLoading ? (
        <div className="flex justify-center rounded-lg border bg-card px-6 py-8">
          <LoadingInline isLoading message="Loading transactions..." />
        </div>
      ) : (
        <>
          <DataTable columns={columns} data={transactions} table={table} />
          <DataTablePagination table={table} />
        </>
      )}
    </section>
  )
}
