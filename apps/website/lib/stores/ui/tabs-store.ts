"use client"

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

type TabsState = {
  activeTabs: Record<string, string>
  setActiveTab: (scope: string, tab: string) => void
  clearActiveTab: (scope: string) => void
  resetTabs: () => void
}

export const useTabsStore = create<TabsState>()(
  persist(
    (set) => ({
      activeTabs: {},
      setActiveTab: (scope, tab) =>
        set((state) => ({
          activeTabs: { ...state.activeTabs, [scope]: tab },
        })),
      clearActiveTab: (scope) =>
        set((state) => {
          const rest = { ...state.activeTabs }
          delete rest[scope]
          return { activeTabs: rest }
        }),
      resetTabs: () => set({ activeTabs: {} }),
    }),
    {
      name: "nexxa-tabs",
      storage: createJSONStorage(() => localStorage),
    }
  )
)
