"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { WithPermissions } from "@/components/features/auth/permissions/with-permissions"
import { useTabsStore } from "@/lib/stores/ui/tabs-store"
import { AddWalletDialog } from "./dialogs/add-wallet-dialog"
import { WithdrawDialog } from "./dialogs/withdraw-dialog"

export function WalletHeaderActions() {
  const activeTab = useTabsStore((state) => state.activeTabs.wallet ?? "overview")
  const [addWalletOpen, setAddWalletOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)

  return (
    <WithPermissions fallback={null}>
      {(permissions) => {
        const isActive = permissions.status === "active"
        const label = activeTab === "saved" ? "Add wallet" : "Withdraw funds"

        if (!isActive) {
          return <Button disabled>{label}</Button>
        }

        if (activeTab === "saved") {
          return (
            <>
              <Button onClick={() => setAddWalletOpen(true)}>Add wallet</Button>
              <AddWalletDialog open={addWalletOpen} onOpenChange={setAddWalletOpen} />
            </>
          )
        }

        return (
          <>
            <Button onClick={() => setWithdrawOpen(true)}>Withdraw funds</Button>
            <WithdrawDialog open={withdrawOpen} onOpenChange={setWithdrawOpen} />
          </>
        )
      }}
    </WithPermissions>
  )
}
