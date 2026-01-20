"use client"

import { useSyncExternalStore } from "react"
import { Monitor, Moon, Palette, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"

const themes = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  if (!mounted) {
    return (
      <div className="grid gap-6 rounded-lg border p-6 text-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Palette className="size-4 text-muted-foreground" />
            <h3 className="font-medium">Interface & appearance</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Customize the look and feel of the application.
          </p>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="theme-select" className="text-sm font-medium">
              Theme
            </Label>
            <p className="text-xs text-muted-foreground">
              Select your preferred color scheme.
            </p>
          </div>
          <Select disabled>
            <SelectTrigger id="theme-select" className="w-[140px]">
              <SelectValue placeholder="Loading..." />
            </SelectTrigger>
          </Select>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-6 rounded-lg border p-6 text-sm">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Palette className="size-4 text-muted-foreground" />
          <h3 className="font-medium">Interface & appearance</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Customize the look and feel of the application.
        </p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <Label htmlFor="theme-select" className="text-sm font-medium">
            Theme
          </Label>
          <p className="text-xs text-muted-foreground">
            Select your preferred color scheme.
          </p>
        </div>
        <Select value={theme || "system"} onValueChange={setTheme}>
          <SelectTrigger id="theme-select" className="w-[140px]">
            <SelectValue placeholder="Select theme" />
          </SelectTrigger>
          <SelectContent position="popper" align="center">
            {themes.map(({ value, label, icon: Icon }) => (
              <SelectItem key={value} value={value}>
                <div className="flex items-center gap-2">
                  <Icon className="size-4" />
                  <span>{label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
