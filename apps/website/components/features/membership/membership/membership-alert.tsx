"use client"

import { AlertTriangle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { useEffect, useState } from "react"

type MembershipAlertProps = {
  inactiveAt: Date | null
  deletionDays?: number
}

function calculateTimeRemaining(inactiveAt: Date | null, deletionDays: number) {
  if (!inactiveAt) {
    return { days: deletionDays, hours: 0, minutes: 0, seconds: 0, percentage: 100 }
  }

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
  const [timeRemaining, setTimeRemaining] = useState(() =>
    calculateTimeRemaining(inactiveAt, deletionDays)
  )

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining(inactiveAt, deletionDays))
    }, 1000)

    return () => clearInterval(interval)
  }, [inactiveAt, deletionDays])

  return (
    <Alert variant="destructive" className="bg-destructive/5 border-destructive/20 text-destructive">
      <AlertTriangle className="size-5" />
      <AlertTitle className="text-lg font-semibold text-destructive">
        Action required
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-4">
        <p className="text-sm text-foreground/80">
          Your account is inactive. You have <span className="font-semibold">{timeRemaining.days}d {timeRemaining.hours}h {timeRemaining.minutes}m</span> to renew before your account is permanently deleted.
        </p>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Time remaining</span>
            <span className="font-mono font-medium">
              {String(timeRemaining.days).padStart(2, "0")}:
              {String(timeRemaining.hours).padStart(2, "0")}:
              {String(timeRemaining.minutes).padStart(2, "0")}:
              {String(timeRemaining.seconds).padStart(2, "0")}
            </span>
          </div>
          <Progress
            value={timeRemaining.percentage}
            className="h-2 bg-destructive/10"
          />
        </div>
      </AlertDescription>
    </Alert>
  )
}
