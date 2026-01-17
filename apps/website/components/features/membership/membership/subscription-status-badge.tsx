import { cn } from "@/lib/utils"

type MembershipStatus = "active" | "inactive" | "deleted"

type SubscriptionStatusBadgeProps = {
  status: MembershipStatus
  className?: string
}

const statusConfig: Record<MembershipStatus, { label: string; color: string }> = {
  active: {
    label: "Active",
    color: "bg-emerald-500",
  },
  inactive: {
    label: "Inactive",
    color: "bg-red-500",
  },
  deleted: {
    label: "Deleted",
    color: "bg-muted-foreground",
  },
}

export function SubscriptionStatusBadge({ status, className }: SubscriptionStatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <div className={cn("flex items-center gap-2 rounded-full border px-2.5 py-0.5 text-xs font-medium shadow-sm", className)}>
      <span className={cn("size-1.5 rounded-full", config.color)} />
      <span className="text-foreground/80">{config.label}</span>
    </div>
  )
}
