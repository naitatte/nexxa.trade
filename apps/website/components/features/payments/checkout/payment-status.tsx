"use client"

import { CheckCircle2, CircleAlert, Loader2, Timer } from "lucide-react"
import { cn } from "@/lib/utils"

type PaymentStatusProps = {
  status?: string
  sweepStatus?: string | null
  appliedAt?: string | null
  confirmedAt?: string | null
  isPolling?: boolean
  isLoading?: boolean
  hasError?: boolean
  errorMessage?: string | null
}

type StatusTone = "waiting" | "finalizing" | "active" | "issue"

type StatusConfig = {
  tone: StatusTone
  title: string
  description: string
}

const normalize = (value?: string | null) => value?.toLowerCase() ?? ""

const buildStatusConfig = ({
  status,
  sweepStatus,
  appliedAt,
  confirmedAt,
  isLoading,
  hasError,
  errorMessage,
}: {
  status?: string
  sweepStatus?: string | null
  appliedAt?: string | null
  confirmedAt?: string | null
  isLoading?: boolean
  hasError?: boolean
  errorMessage?: string | null
}): StatusConfig => {
  const normalizedStatus = normalize(status)
  const normalizedSweep = normalize(sweepStatus)

  const isApplied = Boolean(appliedAt)
  const isSwept = normalizedSweep === "swept"
  const isIssue = normalizedSweep === "failed" || normalizedSweep === "exhausted"
  const isConfirmed = normalizedStatus === "confirmed" || Boolean(confirmedAt)

  if (hasError) {
    return {
      tone: "issue",
      title: "Unable to check payment",
      description: errorMessage || "We couldn&apos;t verify your payment status. Please try again in a moment.",
    }
  }

  if (isIssue) {
    return {
      tone: "issue",
      title: "Issue detected",
      description: "We had trouble finalizing your payment. Please contact support with your payment ID.",
    }
  }

  if (isApplied || isSwept) {
    return {
      tone: "active",
      title: "Membership active",
      description: "Your payment is complete. Enjoy full access to Nexxa Trade.",
    }
  }

  if (isConfirmed) {
    return {
      tone: "finalizing",
      title: "Payment detected, finalizing",
      description: "We&apos;ve detected your payment and are finalizing activation.",
    }
  }

  if (isLoading) {
    return {
      tone: "finalizing",
      title: "Checking payment status",
      description: "Fetching the latest confirmation details.",
    }
  }

  return {
    tone: "waiting",
    title: "Waiting for payment",
    description: "Send the deposit to activate your membership.",
  }
}

export function PaymentStatus({
  status,
  sweepStatus,
  appliedAt,
  confirmedAt,
  isPolling,
  isLoading,
  hasError,
  errorMessage,
}: PaymentStatusProps) {
  const config = buildStatusConfig({
    status,
    sweepStatus,
    appliedAt,
    confirmedAt,
    isLoading,
    hasError,
    errorMessage,
  })

  const Icon = {
    waiting: Timer,
    finalizing: Loader2,
    active: CheckCircle2,
    issue: CircleAlert,
  }[config.tone]

  return (
    <div className={cn(
      "rounded-lg border p-4",
      config.tone === "issue" && "border-destructive/40",
      config.tone === "active" && "border-emerald-500/40"
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          "mt-0.5 shrink-0",
          config.tone === "waiting" && "text-muted-foreground",
          config.tone === "finalizing" && "text-primary",
          config.tone === "active" && "text-emerald-500",
          config.tone === "issue" && "text-destructive"
        )}>
          {config.tone === "finalizing" ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Icon className="size-5" />
          )}
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{config.title}</p>
            {isPolling && config.tone !== "active" && (
              <span className="text-xs text-muted-foreground">Checking...</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{config.description}</p>
          {config.tone === "active" && (
            <p className="text-xs text-muted-foreground mt-2">
              Your membership is being activated...
            </p>
          )}
          {config.tone === "issue" && (
            <p className="text-xs text-muted-foreground mt-2">
              If you already sent funds, contact support and include your payment ID.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
