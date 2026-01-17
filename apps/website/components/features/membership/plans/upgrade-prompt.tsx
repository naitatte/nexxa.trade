import { ArrowUpRight } from "lucide-react"
import Link from "next/link"

type PlanTier = "trial_weekly" | "annual" | "lifetime"

type UpgradePromptProps = {
  currentTier: PlanTier
}

export function UpgradePrompt({ currentTier }: UpgradePromptProps) {
  if (currentTier === "lifetime") {
    return null
  }

  return (
    <Link 
      href="/dashboard/checkout?plan=lifetime"
      className="group relative flex cursor-pointer flex-col justify-between rounded-lg border border-primary/20 bg-primary/5 p-5 transition-all hover:border-primary/30 hover:bg-primary/10 min-h-[140px]"
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="flex-1 min-w-0">
           <h3 className="font-semibold leading-none tracking-tight text-base text-primary">Lifetime</h3>
           <div className="mt-2 flex items-baseline gap-1">
             <span className="text-xl font-bold text-primary">$499</span>
             <span className="text-xs text-muted-foreground">one-time</span>
           </div>
        </div>
        <ArrowUpRight className="size-4 shrink-0 text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform ml-2" />
      </div>

      <div className="space-y-1.5">
         <p className="text-xs text-muted-foreground flex items-center gap-1.5">
           <span className="size-1 rounded-full bg-muted-foreground/40 shrink-0" />
           <span className="line-clamp-1">Lifetime access</span>
         </p>
         <p className="text-xs text-muted-foreground flex items-center gap-1.5">
           <span className="size-1 rounded-full bg-muted-foreground/40 shrink-0" />
           <span className="line-clamp-1">No recurring payments</span>
         </p>
      </div>
    </Link>
  )
}
