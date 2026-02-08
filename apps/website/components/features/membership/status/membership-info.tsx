"use client"

type MembershipInfoProps = {
  tier: string
  planName?: string | null
  priceUsdCents?: number | null
  durationDays?: number | null
  expiresAt?: Date | null
  activatedAt?: Date | null
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return "N/A"
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date)
}

function formatAmount(priceUsdCents?: number | null, durationDays?: number | null): string {
  if (priceUsdCents === null || priceUsdCents === undefined) {
    return "N/A"
  }
  const price = `$${(priceUsdCents / 100).toFixed(2)}`
  if (durationDays === null || durationDays === undefined || durationDays >= 3650) {
    return `${price} one-time`
  }
  if (durationDays === 7) {
    return `${price} / week`
  }
  if (durationDays === 30) {
    return `${price} / month`
  }
  if (durationDays === 365) {
    return `${price} / year`
  }
  return `${price} / ${durationDays} days`
}

export function MembershipInfo({
  tier,
  planName,
  priceUsdCents,
  durationDays,
  expiresAt,
  activatedAt,
}: MembershipInfoProps) {
  const isLifetime = tier === "lifetime" || (durationDays !== null && durationDays !== undefined && durationDays >= 3650)
  const displayName = planName || tier

  return (
    <div className="grid gap-6 rounded-lg border p-6 text-sm">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Current plan</p>
          <p className="font-semibold text-foreground">{displayName}</p>
        </div>

        <div className="space-y-1">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
            {isLifetime ? "Member since" : "Next payment"}
          </p>
          <p className="font-medium">
            {isLifetime ? formatDate(activatedAt) : formatDate(expiresAt)}
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Amount</p>
          <p className="font-medium">{formatAmount(priceUsdCents, durationDays)}</p>
        </div>
      </div>
    </div>
  )
}
