"use client"

import { AlertTriangle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useEffect, useState } from "react"

type MembershipAlertProps = {
  inactiveAt: Date | null
  deletionDays?: number
}

function calculateTimeRemaining(inactiveAt: Date, deletionDays: number) {
  const deletionDate = new Date(inactiveAt)
  deletionDate.setDate(deletionDate.getDate() + deletionDays)

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

export function MembershipAlert({ inactiveAt, deletionDays = 7 }: MembershipAlertProps) {
  const [initialInactiveAt] = useState<Date>(() => inactiveAt ?? new Date())
  const effectiveInactiveAt = inactiveAt ?? initialInactiveAt
  const [timeRemaining, setTimeRemaining] = useState(() =>
    calculateTimeRemaining(effectiveInactiveAt, deletionDays)
  )

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining(effectiveInactiveAt, deletionDays))
    }, 1000)

    return () => clearInterval(interval)
  }, [effectiveInactiveAt, deletionDays])

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
