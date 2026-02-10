"use client"

import { useMemo, useState } from "react"
import { ArrowLeft, ArrowRight, Check, Wallet } from "lucide-react"
import { toast } from "sonner"
import { AnimatePresence, motion } from "framer-motion"

import { Button } from "@/components/ui/button"
import { LoadingSpinner } from "@/lib/loading-state/components"
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
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  useCreateWithdrawal,
  useWalletSummary,
  useWalletDestinations,
} from "@/lib/api/wallet/client"
import { useSession } from "@/lib/auth/hooks"
import { useLoadingState } from "@/lib/loading-state/hooks"
import { translateErrorFromResponse } from "@/lib/error-translations"
import { cn } from "@/lib/utils"

interface WithdrawDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const formatUsd = (cents?: number) => {
  if (typeof cents !== "number") return "—"
  return `$${(cents / 100).toFixed(2)}`
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

const truncateAddress = (address: string, chars = 12) => {
  if (address.length <= chars * 2) return address
  return `${address.slice(0, chars)}…${address.slice(-chars)}`
}

type Step = "amount" | "destination" | "review" | "verify"

const STEPS: Step[] = ["amount", "destination", "review", "verify"]

const STEPS_LABELS: Record<Step, string> = {
  amount: "Amount",
  destination: "Destination",
  review: "Review",
  verify: "Confirm",
}

const variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 20 : -20,
    opacity: 0,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 20 : -20,
    opacity: 0,
  }),
}

export function WithdrawDialog({ open, onOpenChange }: WithdrawDialogProps) {
  const [step, setStep] = useState<Step>("amount")
  const [direction, setDirection] = useState(0)
  const [amount, setAmount] = useState("")
  const [destination, setDestination] = useState("")
  const [selectedDestinationId, setSelectedDestinationId] = useState<string>("manual")
  const [chain, setChain] = useState<string | null>("bsc")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")

  const { data: session } = useSession()
  const twoFactorEnabled = session?.user?.twoFactorEnabled === true
  const { data: summary } = useWalletSummary()
  const { isLoading, setLoading, setSuccess, setError, setIdle } = useLoadingState()
  const { data: destinationsData } = useWalletDestinations()
  const createWithdrawal = useCreateWithdrawal()

  const availableUsdCents = summary?.availableUsdCents ?? 0
  const destinations = destinationsData?.items ?? []
  const defaultDestination = destinations.find((item) => item.isDefault) ?? destinations[0]
  const hasManualDestination = destination.trim().length > 0
  const effectiveSelectedDestinationId = selectedDestinationId !== "manual"
    ? selectedDestinationId
    : hasManualDestination
      ? "manual"
      : (defaultDestination?.id ?? "manual")

  const parsedAmountUsdCents = useMemo(() => {
    const value = Number.parseFloat(amount)
    if (!Number.isFinite(value) || value <= 0) return 0
    return Math.round(value * 100)
  }, [amount])

  const selectedDestination = useMemo(
    () => (effectiveSelectedDestinationId === "manual" ? null : destinations.find((d) => d.id === effectiveSelectedDestinationId)),
    [destinations, effectiveSelectedDestinationId]
  )

  const destinationValue = selectedDestination?.address ?? destination
  const resolvedDestination = destinationValue.trim()
  const resolvedChain = selectedDestination?.chain ?? chain ?? "bsc"

  const handleClose = (next: boolean) => {
    if (!next) {
      setStep("amount")
      setAmount("")
      setDestination("")
      setSelectedDestinationId("manual")
      setChain("bsc")
      setPassword("")
      setCode("")
      setDirection(0)
    }
    onOpenChange(next)
  }

  const changeStep = (newStep: Step) => {
    const newIndex = STEPS.indexOf(newStep)
    const currentIndex = STEPS.indexOf(step)
    setDirection(newIndex > currentIndex ? 1 : -1)
    setStep(newStep)
  }

  const goToAmount = () => changeStep("amount")
  const goToDestination = () => changeStep("destination")
  const goToReview = () => changeStep("review")
  const goToVerify = () => changeStep("verify")

  const canProceedFromAmount = parsedAmountUsdCents > 0 && parsedAmountUsdCents <= availableUsdCents
  const canProceedFromDestination = resolvedDestination.length > 0

  const handleSubmit = async () => {
    if (!resolvedDestination) {
      toast.error("Destination is required.")
      return
    }
    if (parsedAmountUsdCents <= 0) {
      toast.error("Enter a valid amount.")
      return
    }
    if (parsedAmountUsdCents > availableUsdCents) {
      toast.error("Insufficient available balance.")
      return
    }
    if (!password.trim()) {
      toast.error("Password is required.")
      return
    }
    if (twoFactorEnabled && code.trim().length !== 6) {
      toast.error("Enter the 6-digit code from your authenticator app.")
      return
    }
    const isSubmitting = isLoading || createWithdrawal.isPending
    if (isSubmitting) return
    setLoading("Submitting withdrawal...")
    try {
      await createWithdrawal.mutateAsync({
        amountUsdCents: parsedAmountUsdCents,
        destination: resolvedDestination,
        chain: resolvedChain.trim() || null,
        password: password.trim(),
        code: twoFactorEnabled ? code.trim() : undefined,
      })
      setSuccess("Withdrawal request submitted.")
      setIdle()
      handleClose(false)
    } catch (error) {
      const translation = translateErrorFromResponse(error, "Failed to submit withdrawal.")
      setError(translation.message, translation.message)
      setIdle()
    }
  }

  const stepIndex = STEPS.indexOf(step)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <div className="relative mb-8 mt-2">
          <div className="absolute left-4 right-4 top-4 -translate-y-1/2">
            <div className="absolute inset-0 h-0.5 bg-muted" />
            <div
              className="absolute left-0 top-0 h-0.5 bg-primary transition-all duration-300 ease-in-out"
              style={{ width: `${(stepIndex / (STEPS.length - 1)) * 100}%` }}
            />
          </div>

          <div className="relative flex justify-between">
            {STEPS.map((s, i) => {
              const isCompleted = i < stepIndex
              const isCurrent = i === stepIndex

              return (
                <div key={s} className="flex flex-col items-center gap-2">
                  <div
                    className={cn(
                      "relative z-10 flex size-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors bg-background",
                      isCompleted
                        ? "border-primary bg-primary text-primary-foreground"
                        : isCurrent
                          ? "border-primary text-primary ring-4 ring-primary/10"
                          : "border-muted text-muted-foreground"
                    )}
                  >
                    {isCompleted ? <Check className="size-4" /> : i + 1}
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-medium uppercase tracking-wider transition-colors",
                      isCompleted || isCurrent ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {STEPS_LABELS[s]}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="overflow-hidden px-1">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            {step === "amount" && (
              <motion.div
                key="amount"
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.2 }}
              >
                <DialogHeader className="text-left">
                  <DialogTitle>Amount</DialogTitle>
                  <DialogDescription>
                    How much would you like to withdraw? Available:{" "}
                    <span className="font-semibold text-foreground">{formatUsd(availableUsdCents)}</span>
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="rounded-xl border bg-muted/30 p-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Wallet className="size-4" />
                      <span>Available balance</span>
                    </div>
                    <p className="mt-1 text-2xl font-bold tracking-tight">{formatUsd(availableUsdCents)}</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="withdraw-amount">Amount (USD)</Label>
                    <Input
                      id="withdraw-amount"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                    {parsedAmountUsdCents > availableUsdCents && (
                      <p className="text-sm text-destructive">Insufficient balance</p>
                    )}
                  </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                  <Button type="button" variant="ghost" onClick={() => handleClose(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={goToDestination}
                    disabled={!canProceedFromAmount}
                  >
                    Next
                    <ArrowRight className="ml-2 size-4" />
                  </Button>
                </DialogFooter>
              </motion.div>
            )}

            {step === "destination" && (
              <motion.div
                key="destination"
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.2 }}
              >
                <DialogHeader className="text-left">
                  <DialogTitle>Destination</DialogTitle>
                  <DialogDescription>
                    Choose a saved wallet or enter a new address.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  {destinations.length > 0 && (
                    <div className="space-y-2">
                      <Label htmlFor="withdraw-saved">Saved wallet</Label>
                      <Select
                        value={effectiveSelectedDestinationId}
                        onValueChange={(value) => {
                          if (value === "manual") {
                            setSelectedDestinationId("manual")
                            setDestination("")
                            setChain("bsc")
                            return
                          }
                          const selected = destinations.find((item) => item.id === value)
                          if (selected) {
                            setSelectedDestinationId(selected.id)
                            setDestination(selected.address)
                            setChain(selected.chain ?? "bsc")
                          }
                        }}
                      >
                        <SelectTrigger id="withdraw-saved" className="w-full">
                          <SelectValue placeholder="Select a saved wallet" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Enter address manually</SelectItem>
                          {destinations.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.label} ({formatChain(item.chain)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="withdraw-destination">Wallet address</Label>
                    <Input
                      id="withdraw-destination"
                      type="text"
                      placeholder="0x..."
                      value={destinationValue}
                      onChange={(e) => {
                        setDestination(e.target.value)
                        setSelectedDestinationId("manual")
                      }}
                    />
                  </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                  <Button type="button" variant="ghost" onClick={goToAmount}>
                    <ArrowLeft className="mr-2 size-4" />
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={goToReview}
                    disabled={!canProceedFromDestination}
                  >
                    Next
                    <ArrowRight className="ml-2 size-4" />
                  </Button>
                </DialogFooter>
              </motion.div>
            )}

            {step === "review" && (
              <motion.div
                key="review"
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.2 }}
              >
                <DialogHeader className="text-left">
                  <DialogTitle>Review</DialogTitle>
                  <DialogDescription>
                    Confirm your withdrawal details before submitting.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Amount</span>
                      <span className="font-semibold">{formatUsd(parsedAmountUsdCents)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Destination</span>
                      <span className="font-mono text-xs">
                        {selectedDestination?.label ?? truncateAddress(resolvedDestination)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Network</span>
                      <span className="font-medium">{formatChain(resolvedChain)}</span>
                    </div>
                    {selectedDestination && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Address</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {truncateAddress(resolvedDestination)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                  <Button type="button" variant="ghost" onClick={goToDestination}>
                    <ArrowLeft className="mr-2 size-4" />
                    Back
                  </Button>
                  <Button type="button" onClick={goToVerify}>
                    Next
                    <ArrowRight className="ml-2 size-4" />
                  </Button>
                </DialogFooter>
              </motion.div>
            )}

            {step === "verify" && (
              <motion.div
                key="verify"
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.2 }}
              >
                <DialogHeader className="text-left">
                  <DialogTitle>Confirm your identity</DialogTitle>
                  <DialogDescription>
                    Enter your password{twoFactorEnabled ? " and authentication code" : ""} to
                    submit the withdrawal request.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Amount</span>
                      <span className="font-semibold">{formatUsd(parsedAmountUsdCents)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Destination</span>
                      <span className="font-mono text-xs">
                        {selectedDestination?.label ?? truncateAddress(resolvedDestination)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="withdraw-password">Password</Label>
                    <Input
                      id="withdraw-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      disabled={isLoading || createWithdrawal.isPending}
                    />
                  </div>
                  {twoFactorEnabled && (
                    <div className="space-y-2">
                      <Label htmlFor="withdraw-code">Authentication code</Label>
                      <div className="flex justify-center">
                        <InputOTP
                          id="withdraw-code"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          value={code}
                          onChange={(value) => setCode(value)}
                          disabled={isLoading || createWithdrawal.isPending}
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
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={goToReview}
                    disabled={isLoading || createWithdrawal.isPending}
                  >
                    <ArrowLeft className="mr-2 size-4" />
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isLoading || createWithdrawal.isPending}
                  >
                    {(isLoading || createWithdrawal.isPending) && (
                      <LoadingSpinner size="sm" className="mr-2" />
                    )}
                    {isLoading || createWithdrawal.isPending ? "Submitting…" : "Submit request"}
                  </Button>
                </DialogFooter>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  )
}
