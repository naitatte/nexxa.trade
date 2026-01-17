import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"

type PlanTier = "trial_weekly" | "annual" | "lifetime"

type MembershipInfoProps = {
  tier: PlanTier
  expiresAt?: Date | null
  activatedAt?: Date | null
}

const tierNames: Record<PlanTier, string> = {
  trial_weekly: "Trial weekly",
  annual: "Pro annual",
  lifetime: "Lifetime membership",
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return "N/A"
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date)
}

export function MembershipInfo({ tier, expiresAt, activatedAt }: MembershipInfoProps) {
  const isLifetime = tier === "lifetime"

  return (
    <div className="grid gap-6 rounded-lg border p-6 text-sm">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Current plan</p>
          <p className="font-semibold text-foreground">{tierNames[tier]}</p>
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
          <p className="font-medium">
            {tier === "trial_weekly" ? "$9.00 / week" : tier === "annual" ? "$299.00 / year" : "$499.00 one-time"}
          </p>
        </div>
      </div>
      
      {isLifetime && (
        <div className="flex items-center justify-end border-t pt-4">
            <Button variant="ghost" size="sm" className="h-8 text-xs">
              <Download className="mr-2 size-3.5" />
              Download receipt
            </Button>
        </div>
      )}
    </div>
  )
}
