"use client"

import { useState, type FormEvent } from "react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { LoadingSpinner } from "@/lib/loading-state/components"
import { useLoadingState } from "@/lib/loading-state/hooks"
import { useCreateWalletDestination } from "@/lib/api/wallet/client"
import { useSession } from "@/lib/auth/hooks"
import { translateErrorFromResponse } from "@/lib/error-translations"

type Step = "details" | "verify"

interface AddWalletDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddWalletDialog({ open, onOpenChange }: AddWalletDialogProps) {
  const [step, setStep] = useState<Step>("details")
  const [label, setLabel] = useState("")
  const [address, setAddress] = useState("")
  const [isDefault, setIsDefault] = useState(false)
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")

  const { data: session } = useSession()
  const twoFactorEnabled = session?.user?.twoFactorEnabled === true
  const createDestination = useCreateWalletDestination()
  const { isLoading, setLoading, setSuccess, setError, setIdle } = useLoadingState()

  const handleDetailsSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!label.trim()) {
      toast.error("Label is required.")
      return
    }
    if (!address.trim()) {
      toast.error("Address is required.")
      return
    }
    setStep("verify")
  }

  const handleVerifySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!password.trim()) {
      toast.error("Password is required.")
      return
    }
    if (twoFactorEnabled && code.trim().length !== 6) {
      toast.error("Enter the 6-digit code from your authenticator app.")
      return
    }
    const isSubmitting = isLoading || createDestination.isPending
    if (isSubmitting) return
    setLoading("Saving wallet...")
    try {
      await createDestination.mutateAsync({
        label: label.trim(),
        address: address.trim(),
        chain: "bsc",
        isDefault,
        password: password.trim(),
        code: twoFactorEnabled ? code.trim() : undefined,
      })
      setSuccess("Wallet saved.")
      setIdle()
      onOpenChange(false)
      setLabel("")
      setAddress("")
      setIsDefault(false)
      setPassword("")
      setCode("")
      setStep("details")
    } catch (error) {
      const translation = translateErrorFromResponse(error, "Failed to save wallet.")
      setError(translation.message, translation.message)
      setIdle()
    }
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setLabel("")
      setAddress("")
      setIsDefault(false)
      setPassword("")
      setCode("")
      setStep("details")
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {step === "details" && (
          <>
            <DialogHeader className="text-left">
              <DialogTitle>Add wallet</DialogTitle>
              <DialogDescription>
                Save a withdrawal address for quick access when requesting payouts.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleDetailsSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="add-wallet-label">Label</Label>
                <Input
                  id="add-wallet-label"
                  placeholder="Main USDT"
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-wallet-address">Address</Label>
                <Input
                  id="add-wallet-address"
                  placeholder="0x..."
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="add-wallet-default"
                  checked={isDefault}
                  onCheckedChange={(value) => setIsDefault(Boolean(value))}
                />
                <Label htmlFor="add-wallet-default" className="text-sm">
                  Set as default wallet
                </Label>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit">Continue</Button>
              </DialogFooter>
            </form>
          </>
        )}

        {step === "verify" && (
          <>
            <DialogHeader className="text-left">
              <DialogTitle>Confirm your identity</DialogTitle>
              <DialogDescription>
                Enter your password{twoFactorEnabled ? " and authentication code" : ""} to add this wallet.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleVerifySubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="add-wallet-password">Password</Label>
                <Input
                  id="add-wallet-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  disabled={isLoading || createDestination.isPending}
                />
              </div>
              {twoFactorEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="add-wallet-code">Authentication code</Label>
                  <div className="flex justify-center">
                    <InputOTP
                      id="add-wallet-code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={code}
                      onChange={(value) => setCode(value)}
                      disabled={isLoading || createDestination.isPending}
                    >
                      <InputOTPGroup className="gap-2">
                        {Array.from({ length: 6 }).map((_, index) => (
                          <InputOTPSlot key={index} index={index} />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep("details")}
                  disabled={isLoading || createDestination.isPending}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading || createDestination.isPending}
                >
                  {(isLoading || createDestination.isPending) && (
                    <LoadingSpinner size="sm" className="mr-2" />
                  )}
                  {isLoading || createDestination.isPending ? "Saving..." : "Save wallet"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
