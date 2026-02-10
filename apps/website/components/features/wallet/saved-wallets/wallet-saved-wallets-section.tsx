"use client"

import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ExternalLink, Star, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { LoadingInline, LoadingSpinner } from "@/lib/loading-state/components"
import { ErrorAlert } from "@/lib/error-state/components"
import { DataTable } from "@/components/ui/data-table"
import { DataTablePagination } from "@/components/ui/data-table-pagination"
import {
  useDeleteWalletDestination,
  useSetDefaultWalletDestination,
  useWalletDestinations,
} from "@/lib/api/wallet/client"

type WalletDestination = {
  id: string
  label: string
  address: string
  chain: string | null
  isDefault: boolean
  createdAt: string
  updatedAt: string
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

const truncate = (value: string, max = 18) => {
  if (value.length <= max) return value
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}

export function WalletSavedWalletsSection() {
  const { data, isLoading, isError, error, refetch } = useWalletDestinations()
  const deleteDestination = useDeleteWalletDestination()
  const setDefault = useSetDefaultWalletDestination()
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [destinationToDelete, setDestinationToDelete] =
    React.useState<WalletDestination | null>(null)
  const [defaultDialogOpen, setDefaultDialogOpen] = React.useState(false)
  const [destinationToSetDefault, setDestinationToSetDefault] =
    React.useState<WalletDestination | null>(null)

  const destinations = data?.items ?? []

  const handleSetDefaultClick = React.useCallback((destination: WalletDestination) => {
    setDestinationToSetDefault(destination)
    setDefaultDialogOpen(true)
  }, [])

  const handleSetDefaultConfirm = React.useCallback(async () => {
    if (!destinationToSetDefault) return
    try {
      await setDefault.mutateAsync({
        destinationId: destinationToSetDefault.id,
      })
      toast.success("Default wallet updated.")
      setDefaultDialogOpen(false)
      setDestinationToSetDefault(null)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update default wallet."
      )
    }
  }, [destinationToSetDefault, setDefault])

  const handleSetDefaultCancel = React.useCallback(() => {
    setDefaultDialogOpen(false)
    setDestinationToSetDefault(null)
  }, [])

  const handleDeleteClick = React.useCallback((destination: WalletDestination) => {
    setDestinationToDelete(destination)
    setDeleteDialogOpen(true)
  }, [])

  const handleDeleteConfirm = React.useCallback(async () => {
    if (!destinationToDelete) return
    try {
      await deleteDestination.mutateAsync({
        destinationId: destinationToDelete.id,
      })
      toast.success("Wallet deleted.")
      setDeleteDialogOpen(false)
      setDestinationToDelete(null)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete wallet."
      )
    }
  }, [destinationToDelete, deleteDestination])

  const handleDeleteCancel = React.useCallback(() => {
    setDeleteDialogOpen(false)
    setDestinationToDelete(null)
  }, [])

  const columns = React.useMemo<ColumnDef<WalletDestination>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: "Added",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
      {
        accessorKey: "label",
        header: "Label",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.label}</span>
        ),
      },
      {
        accessorKey: "isDefault",
        header: "Default",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.isDefault ? "Yes" : "No"}
          </span>
        ),
      },
      {
        accessorKey: "address",
        header: "Address",
        cell: ({ row }) => {
          const addr = row.original.address
          const short = truncate(addr)
          return (
            <a
              href={`https://bscscan.com/address/${addr}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-mono text-sm font-medium text-foreground hover:underline transition-colors"
              title={addr}
            >
              {short}
              <ExternalLink className="size-3" />
            </a>
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
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            {!row.original.isDefault && (
              <Button
                size="icon"
                variant="outline"
                className="rounded-full"
                onClick={() => handleSetDefaultClick(row.original)}
                disabled={setDefault.isPending}
                aria-label="Set default wallet"
              >
                <Star className="size-4" />
              </Button>
            )}
            <Button
              size="icon"
              variant="destructive"
              className="rounded-full"
              onClick={() => handleDeleteClick(row.original)}
              disabled={deleteDestination.isPending}
              aria-label="Delete wallet"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ),
      },
    ],
    [
      handleSetDefaultClick,
      handleDeleteClick,
      deleteDestination.isPending,
      setDefault.isPending,
    ]
  )

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: destinations,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  return (
    <section className="space-y-4">
      <Dialog
        open={defaultDialogOpen}
        onOpenChange={(open) => !open && handleSetDefaultCancel()}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Set default wallet</DialogTitle>
            <DialogDescription>
              Use {destinationToSetDefault?.label ?? "this wallet"} as your default
              withdrawal destination?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleSetDefaultCancel}>
              Cancel
            </Button>
            <Button
              onClick={handleSetDefaultConfirm}
              disabled={setDefault.isPending}
            >
              {setDefault.isPending ? "Updating..." : "Set default"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={(open) => !open && handleDeleteCancel()}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete wallet</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {destinationToDelete?.label ?? "this wallet"}? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleDeleteCancel}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteDestination.isPending}
            >
              {deleteDestination.isPending && <LoadingSpinner size="sm" className="mr-2" />}
              {deleteDestination.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isError && error && (
        <ErrorAlert
          error={error instanceof Error ? error : String(error)}
          onDismiss={() => refetch()}
        />
      )}
      {isLoading ? (
        <div className="flex justify-center rounded-lg border bg-card px-6 py-8">
          <LoadingInline isLoading message="Loading saved wallets..." />
        </div>
      ) : (
        <>
          <DataTable columns={columns} data={destinations} table={table} />
          <DataTablePagination table={table} />
        </>
      )}
    </section>
  )
}
