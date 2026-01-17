import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

type PlanTier = "trial_weekly" | "annual" | "lifetime"

type PlanCardProps = {
  tier: PlanTier
  currentTier?: PlanTier | null
  isActive?: boolean
  onSelect?: () => void
}

const planConfig: Record<PlanTier, {
  name: string
  price: string
  period: string
  features: string[]
  popular?: boolean
}> = {
  trial_weekly: {
    name: "Trial",
    price: "$9",
    period: "/week",
    features: ["Basic signals", "Email support"],
  },
  annual: {
    name: "Annual",
    price: "$299",
    period: "/year",
    features: ["Everything included", "Priority support", "Save $170"],
    popular: true,
  },
  lifetime: {
    name: "Lifetime",
    price: "$499",
    period: "one-time",
    features: ["Lifetime access", "No recurring payments", "VIP"],
  },
}

export function PlanCard({ tier, currentTier, isActive, onSelect }: PlanCardProps) {
  const config = planConfig[tier]
  const isCurrentPlan = currentTier === tier
  const isSelected = isActive ?? isCurrentPlan

  return (
    <div
      onClick={!isCurrentPlan ? onSelect : undefined}
      className={cn(
        "group relative flex cursor-pointer flex-col justify-between rounded-lg border p-5 transition-all hover:border-foreground/20 min-h-[140px]",
        isSelected ? "bg-muted/40 cursor-default border-foreground/10" : "bg-card",
        config.popular && !isCurrentPlan && "border-primary/40 bg-primary/5"
      )}
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="flex-1 min-w-0">
           <h3 className="font-semibold leading-none tracking-tight text-base">{config.name}</h3>
           <div className="mt-2 flex items-baseline gap-1">
             <span className="text-xl font-bold">{config.price}</span>
             <span className="text-xs text-muted-foreground">{config.period}</span>
           </div>
        </div>
        {isCurrentPlan ? (
             <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-background ml-2">
               <Check className="size-3" />
             </span>
        ) : (
            <div className="size-4 shrink-0 rounded-full border border-muted-foreground/30 group-hover:border-primary ml-2" />
        )}
      </div>

      <div className="space-y-1.5">
         {config.features.slice(0, 2).map((f) => (
           <p key={f} className="text-xs text-muted-foreground flex items-center gap-1.5">
             <span className="size-1 rounded-full bg-muted-foreground/40 shrink-0" />
             <span className="line-clamp-1">{f}</span>
           </p>
         ))}
      </div>
    </div>
  )
}
