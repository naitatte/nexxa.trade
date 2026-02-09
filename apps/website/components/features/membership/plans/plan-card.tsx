import { cn } from "@/lib/utils"

export const formatUsd = (cents: number) => `${(cents / 100).toFixed(2)} USDT`

function formatBillingLabel(durationDays?: number | null): string {
  if (durationDays === null || durationDays === undefined) {
    return "one-time";
  }
  if (durationDays >= 3650) {
    return "one-time";
  }
  if (durationDays === 7) {
    return "/week";
  }
  if (durationDays === 30) {
    return "/month";
  }
  if (durationDays === 365) {
    return "/year";
  }
  return `/${durationDays} days`;
}

interface PlanCardProps {
  tier: string
  name: string
  description?: string | null
  priceUsdCents: number
  durationDays?: number | null
  isCurrent: boolean
  onClick: () => void
  className?: string
}

export function PlanCard({
  tier,
  name,
  description,
  priceUsdCents,
  durationDays,
  isCurrent,
  onClick,
  className,
}: PlanCardProps) {
  const billingLabel = formatBillingLabel(durationDays)

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative w-full sm:w-[350px] rounded-lg border p-6 transition-colors cursor-pointer",
        isCurrent ? "border-primary bg-primary/5" : "hover:border-primary/50 bg-card",
        className
      )}
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{name || tier}</p>
          {isCurrent && (
            <div className="h-2 w-2 rounded-full bg-primary" />
          )}
        </div>
        <div className="flex items-baseline gap-1">
          <p className="text-2xl font-semibold">{formatUsd(priceUsdCents)}</p>
          {billingLabel && (
            <p className="text-xs text-muted-foreground">{billingLabel}</p>
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  )
}
