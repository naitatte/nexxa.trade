"use client"

import { AlertTriangle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useEffect, useState } from "react"

type MembershipAlertProps = {
  inactiveAt: Date | null
  deletionAt?: Date | null
  deletionDays?: number
}

function resolveDeletionDate(
  inactiveAt: Date,
  deletionAt: Date | null | undefined,
  deletionDays: number
) {
  if (deletionAt) return deletionAt
  const deletionDate = new Date(inactiveAt)
  deletionDate.setDate(deletionDate.getDate() + deletionDays)
  return deletionDate
}

function calculateTimeRemaining(
  inactiveAt: Date,
  deletionAt: Date | null | undefined,
  deletionDays: number
) {
  const deletionDate = resolveDeletionDate(inactiveAt, deletionAt, deletionDays)

  const now = new Date()
  const totalMs = deletionDays * 24 * 60 * 60 * 1000
  const remainingMs = Math.max(0, deletionDate.getTime() - now.getTime())

  const days = Math.floor(remainingMs / (24 * 60 * 60 * 1000))
  const hours = Math.floor((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
  const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000))
  const seconds = Math.floor((remainingMs % (60 * 1000)) / 1000)
  const percentage = (remainingMs / totalMs) * 100

  return { days, hours, minutes, seconds, percentage }
}

export function MembershipAlert({
  inactiveAt,
  deletionAt,
  deletionDays = 7,
}: MembershipAlertProps) {
  const [initialInactiveAt] = useState<Date>(() => inactiveAt ?? new Date())
  const effectiveInactiveAt = inactiveAt ?? initialInactiveAt
  const [timeRemaining, setTimeRemaining] = useState(() =>
    calculateTimeRemaining(effectiveInactiveAt, deletionAt, deletionDays)
  )

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining(
        calculateTimeRemaining(effectiveInactiveAt, deletionAt, deletionDays)
      )
    }, 1000)

    return () => clearInterval(interval)
  }, [effectiveInactiveAt, deletionAt, deletionDays])

  return (
    <Alert variant="destructive" className="bg-destructive/5 border-destructive/20 text-destructive">
      <AlertTriangle className="size-5" />
      <AlertTitle className="text-base font-semibold text-destructive">
        Action required
      </AlertTitle>
      <AlertDescription className="mt-1.5">
        <p className="text-sm text-foreground/90">
          Account inactive. Renew within <span className="font-semibold">{timeRemaining.days}d {timeRemaining.hours}h {timeRemaining.minutes}m</span> or it will be permanently deleted.
        </p>
      </AlertDescription>
    </Alert>
  )
}
