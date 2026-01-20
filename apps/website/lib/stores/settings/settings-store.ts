"use client"

import { create } from "zustand"

export type SettingsUser = {
  id: string
  name: string
  email: string
  image?: string | null
  emailVerified: boolean
  createdAt: Date
}

export type NotificationPrefs = {
  expirationAlerts: boolean
  signalAlerts: boolean
  commissionAlerts: boolean
}

type SettingsState = {
  user: SettingsUser | null
  notificationPrefs: NotificationPrefs
  setUser: (user: SettingsUser) => void
  updateUser: (partial: Partial<SettingsUser>) => void
  setNotificationPrefs: (prefs: NotificationPrefs) => void
  setNotificationPref: (key: keyof NotificationPrefs, value: boolean) => void
}

const defaultNotificationPrefs: NotificationPrefs = {
  expirationAlerts: true,
  signalAlerts: true,
  commissionAlerts: true,
}

export const useSettingsStore = create<SettingsState>((set) => ({
  user: null,
  notificationPrefs: defaultNotificationPrefs,
  setUser: (user) => set({ user }),
  updateUser: (partial) =>
    set((state) =>
      state.user ? { user: { ...state.user, ...partial } } : state
    ),
  setNotificationPrefs: (prefs) => set({ notificationPrefs: prefs }),
  setNotificationPref: (key, value) =>
    set((state) => ({
      notificationPrefs: { ...state.notificationPrefs, [key]: value },
    })),
}))
