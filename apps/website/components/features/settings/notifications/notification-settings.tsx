"use client"

import { Bell, CreditCard, MessageSquare, Users } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

type NotificationSettingsProps = {
  expirationAlerts?: boolean
  signalAlerts?: boolean
  commissionAlerts?: boolean
  onExpirationAlertsChange?: (value: boolean) => void
  onSignalAlertsChange?: (value: boolean) => void
  onCommissionAlertsChange?: (value: boolean) => void
}

export function NotificationSettings({
  expirationAlerts = true,
  signalAlerts = true,
  commissionAlerts = true,
  onExpirationAlertsChange,
  onSignalAlertsChange,
  onCommissionAlertsChange,
}: NotificationSettingsProps) {
  return (
    <div className="grid gap-6 rounded-lg border p-6 text-sm">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Bell className="size-4 text-muted-foreground" />
          <h3 className="font-medium">Notification preferences</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Configure how you want to receive important updates.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <CreditCard className="mt-0.5 size-4 text-muted-foreground" />
            <div className="space-y-0.5">
              <Label htmlFor="expiration-alerts" className="text-sm font-medium">
                Expiration alerts
              </Label>
              <p className="text-xs text-muted-foreground">
                Get notified when your subscription is close to expiring.
              </p>
            </div>
          </div>
          <Switch
            id="expiration-alerts"
            checked={expirationAlerts}
            onCheckedChange={onExpirationAlertsChange}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <MessageSquare className="mt-0.5 size-4 text-muted-foreground" />
            <div className="space-y-0.5">
              <Label htmlFor="signal-alerts" className="text-sm font-medium">
                Signal alerts
              </Label>
              <p className="text-xs text-muted-foreground">
                Receive notifications when new messages arrive in the messenger.
              </p>
            </div>
          </div>
          <Switch
            id="signal-alerts"
            checked={signalAlerts}
            onCheckedChange={onSignalAlertsChange}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Users className="mt-0.5 size-4 text-muted-foreground" />
            <div className="space-y-0.5">
              <Label htmlFor="commission-alerts" className="text-sm font-medium">
                Commission alerts
              </Label>
              <p className="text-xs text-muted-foreground">
                Get notified when new members join your network or you earn commissions.
              </p>
            </div>
          </div>
          <Switch
            id="commission-alerts"
            checked={commissionAlerts}
            onCheckedChange={onCommissionAlertsChange}
          />
        </div>
      </div>
    </div>
  )
}