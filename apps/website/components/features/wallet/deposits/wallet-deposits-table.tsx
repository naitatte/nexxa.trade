"use client"

import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ArrowDownRight } from "lucide-react"
import { DataTable } from "@/components/ui/data-table"
import { DataTablePagination } from "@/components/ui/data-table-pagination"
import { LoadingInline } from "@/lib/loading-state/components"
import type { WalletTransaction } from "@/lib/api/wallet/client"

type WalletDepositsTableProps = {
  readonly deposits: WalletTransaction[]
  readonly isLoading?: boolean
}

const formatDate = (value: string | null | undefined): string => {
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

const getSourceLabel = (tx: WalletTransaction) => {
  if (tx.type === "deposit") return "Referral commission"
  return "Deposit"
}

export function WalletDepositsTable({
  deposits,
  isLoading = false,
}: WalletDepositsTableProps) {
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
        header: "Source",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <ArrowDownRight className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="font-medium">{getSourceLabel(row.original)}</span>
          </div>
        ),
      },
      {
        accessorKey: "amountUsdCents",
        header: "Amount",
        cell: ({ row }) => (
          <span className="font-medium tabular-nums text-green-600 dark:text-green-400">
            +{formatUsd(row.original.amountUsdCents)}
          </span>
        ),
      },
    ],
    []
  )

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: deposits,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  if (isLoading) {
    return (
      <section className="space-y-4">
        <div className="space-y-0.5">
          <h2 className="text-base font-semibold tracking-tight">Income movements</h2>
          <p className="text-sm text-muted-foreground">Commissions from sponsors and other earnings credited to your wallet.</p>
        </div>
        <div className="rounded-lg border bg-card px-6 py-8">
          <LoadingInline isLoading message="Loading income movements..." />
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <div className="space-y-0.5">
        <h2 className="text-base font-semibold tracking-tight">Referral commissions</h2>
        <p className="text-sm text-muted-foreground">Commissions received from your referrals, available for withdrawal.</p>
      </div>
      <DataTable columns={columns} data={deposits} table={table} />
      <DataTablePagination table={table} />
    </section>
  )
}
