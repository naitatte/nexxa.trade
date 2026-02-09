"use client"

import { useEffect, useMemo, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import QRCode from "react-qr-code"
import { Check, Copy } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { usePostApiPaymentsAddress, useGetApiPaymentsPaymentId } from "@/lib/api/payments/payments"
import { PaymentStatus } from "@/components/features/payments/checkout/payment-status"
import { useErrorState } from "@/lib/error-state/hooks"
import { useLoadingState } from "@/lib/loading-state/hooks"
import { LoadingSpinner } from "@/lib/loading-state/components"
import { extractErrorCode, translateErrorFromResponse } from "@/lib/error-translations"

const formatUsdt = (cents: number) => (cents / 100).toFixed(2)
const formatDuration = (durationDays: number | null) => {
  if (durationDays === null) return "Lifetime"
  if (durationDays >= 3650) return "Lifetime"
  return `${durationDays} Days`
}

type CheckoutFlowProps = {
  tier: string
  planName?: string | null
  priceUsdCents: number
  durationDays: number | null
  onReset?: () => void
}

type PaymentIntent = {
  paymentId: string
  depositAddress: string
  amountUsdCents: number
  chain: string
}

export function CheckoutFlow({ tier, planName, priceUsdCents, durationDays, onReset }: CheckoutFlowProps) {
  const router = useRouter()
  const [payment, setPayment] = useState<PaymentIntent | null>(null)
  const [copiedField, setCopiedField] = useState<"address" | "amount" | null>(null)
  const hasRefreshedRef = useRef(false)
  const createError = useErrorState({ showToast: false })
  const statusError = useErrorState({ showToast: false })
  const clearCreateError = createError.clearError
  const clearStatusError = statusError.clearError
  const { setLoading, setIdle } = useLoadingState()

  const createPaymentMutation = usePostApiPaymentsAddress({
    mutation: {
      onMutate: () => {
        setLoading("Preparing payment...")
      },
      onSuccess: (data) => {
        setIdle()
        setPayment({
          paymentId: data.paymentId,
          depositAddress: data.depositAddress,
          amountUsdCents: data.amountUsdCents,
          chain: data.chain,
        })
        clearCreateError()
      },
      onError: (error) => {
        setIdle()
        const translation = translateErrorFromResponse(error, "Could not create a payment intent. Please try again.")
        const errorCode = extractErrorCode(error)
        const errorObj = error instanceof Error ? error : new Error(String(error))
        createError.setError(errorObj, translation.message, errorCode || undefined, false)
      },
    },
  })

  const paymentId = payment?.paymentId ?? ""

  const {
    data: paymentStatus,
    isFetching: isPolling,
    isLoading: isLoadingStatus,
    isError: isStatusError,
    error: statusQueryError,
  } = useGetApiPaymentsPaymentId(paymentId, {
    query: {
      enabled: Boolean(paymentId),
      refetchInterval: 8000,
    },
  })

  const resolvedPayment = useMemo(() => {
    if (!payment) return null
    return {
      paymentId,
      depositAddress: paymentStatus?.depositAddress || payment.depositAddress,
      amountUsdCents: paymentStatus?.amountUsdCents ?? payment.amountUsdCents,
      chain: paymentStatus?.chain || payment.chain || "bsc",
    }
  }, [payment, paymentId, paymentStatus?.amountUsdCents, paymentStatus?.chain, paymentStatus?.depositAddress])

  const handleCreatePayment = () => {
    clearCreateError()
    createPaymentMutation.mutate({
      data: { tier },
    })
  }

  const handleCopy = async (value: string, field: "address" | "amount") => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedField(field)
      toast.success(field === "address" ? "Address copied" : "Amount copied")
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      toast.error("Failed to copy. Please copy manually.")
    }
  }

  useEffect(() => {
    if (!paymentId) {
      clearStatusError()
    }
  }, [paymentId, clearStatusError])

  useEffect(() => {
    if (isStatusError && statusQueryError) {
      const translation = translateErrorFromResponse(statusQueryError, "Unable to check payment status.")
      const errorCode = extractErrorCode(statusQueryError)
      const errorObj = statusQueryError instanceof Error ? statusQueryError : new Error(String(statusQueryError))
      statusError.setError(errorObj, translation.message, errorCode || undefined, false)
    }
  }, [isStatusError, statusQueryError, statusError])

  useEffect(() => {
    if (!paymentStatus || hasRefreshedRef.current) return

    const normalizedSweep = paymentStatus.sweepStatus?.toLowerCase() ?? ""
    const isApplied = Boolean(paymentStatus.appliedAt)
    const isSwept = normalizedSweep === "swept"
    const isPaymentComplete = isApplied || isSwept

    if (isPaymentComplete) {
      hasRefreshedRef.current = true
      if (onReset) {
        onReset()
      }
      setTimeout(() => {
        router.refresh()
      }, 1500)
    }
  }, [paymentStatus, router, onReset])

  if (!resolvedPayment) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Plan</span>
            <span className="font-medium">{planName || tier.replace(/_/g, " ")}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Duration</span>
            <span className="font-medium">{formatDuration(durationDays)}</span>
          </div>
          <div className="border-t pt-3 flex items-center justify-between">
            <span className="font-medium">Total (USDT)</span>
            <span className="text-lg font-bold">{formatUsdt(priceUsdCents)} USDT</span>
          </div>
        </div>

        {createError.hasError && (
          <p className="text-sm text-destructive text-center">{createError.getErrorMessage()}</p>
        )}

        <div className="space-y-3">
          <Button 
            onClick={handleCreatePayment} 
            disabled={createPaymentMutation.isPending} 
            className="w-full" 
            size="lg"
          >
            {createPaymentMutation.isPending ? (
              <>
                <LoadingSpinner size="sm" />
                Preparing payment...
              </>
            ) : (
              "Proceed to Payment"
            )}
          </Button>
          
          {onReset && (
            <Button 
              variant="ghost" 
              className="w-full" 
              onClick={onReset}
              disabled={createPaymentMutation.isPending}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>
    )
  }

  const amountUsdt = formatUsdt(resolvedPayment.amountUsdCents)

  return (
    <div className="space-y-6">
      <PaymentStatus
        status={paymentStatus?.status}
        sweepStatus={paymentStatus?.sweepStatus ?? null}
        appliedAt={paymentStatus?.appliedAt ?? null}
        confirmedAt={paymentStatus?.confirmedAt ?? null}
        isPolling={isPolling}
        isLoading={isLoadingStatus}
        hasError={isStatusError || statusError.hasError}
        errorMessage={statusError.getErrorMessage("Unable to check payment status.")}
      />

      <div className="flex flex-col items-center space-y-6">
        <div className="flex flex-col items-center justify-center p-6 bg-white rounded-xl border shadow-sm">
          <QRCode 
            value={resolvedPayment.depositAddress} 
            size={240} 
            level="H"
            className="rounded-lg"
          />
        </div>

        <div className="w-full space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span className="font-medium uppercase tracking-wider">Deposit Address</span>
              <span className="flex items-center gap-1">
                USDT (BEP-20)
              </span>
            </div>
            <div 
              className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 transition-colors hover:bg-muted/50 cursor-pointer group"
              onClick={() => handleCopy(resolvedPayment.depositAddress, "address")}
            >
              <code className="flex-1 text-xs sm:text-sm font-mono break-all text-foreground/90 group-hover:text-foreground">
                {resolvedPayment.depositAddress}
              </code>
              <div className="shrink-0 text-muted-foreground group-hover:text-foreground transition-colors">
                {copiedField === "address" ? (
                  <Check className="size-4 text-emerald-500" />
                ) : (
                  <Copy className="size-4" />
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span className="font-medium uppercase tracking-wider">Amount</span>
              <span className="text-xs">Exact amount required</span>
            </div>
            <div 
              className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 transition-colors hover:bg-muted/50 cursor-pointer group"
              onClick={() => handleCopy(amountUsdt, "amount")}
            >
              <span className="flex-1 text-sm font-semibold text-foreground/90 group-hover:text-foreground">
                {amountUsdt} USDT
              </span>
              <div className="shrink-0 text-muted-foreground group-hover:text-foreground transition-colors">
                {copiedField === "amount" ? (
                  <Check className="size-4 text-emerald-500" />
                ) : (
                  <Copy className="size-4" />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="text-center space-y-2">
           <p className="text-xs text-muted-foreground max-w-[280px] mx-auto leading-relaxed">
            Send exactly <span className="font-medium text-foreground">{amountUsdt} USDT</span> on the <span className="font-medium text-foreground">BSC (BEP-20)</span> network.
          </p>
          {statusError.hasError && (
            <p className="text-xs text-destructive font-medium animate-in fade-in slide-in-from-top-1">
              {statusError.getErrorMessage()}
            </p>
          )}
        </div>

        <div className="pt-2">
          <p className="text-[10px] text-muted-foreground/50 font-mono text-center">
            ID: {resolvedPayment.paymentId}
          </p>
        </div>
      </div>
    </div>
  )
}
