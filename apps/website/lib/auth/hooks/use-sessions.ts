"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useSession } from "../hooks"
import { parseUserAgent, getLocationFromIp } from "../utils"
import {
  useListUserSessions,
  usePostApiAuthRevokeSession,
  usePostApiAuthRevokeOtherSessions,
  getListUserSessionsQueryKey,
} from "@/lib/api/auth/auth"

export type SessionInfo = {
  id: string
  token: string
  device: string
  browser: string
  location: string
  lastActive: Date
  isCurrent: boolean
}

export function useSessions() {
  const { data: session, isPending: isSessionPending } = useSession()
  const currentSessionId = session?.session?.id

  return useListUserSessions<SessionInfo[]>({
    query: {
      enabled: !isSessionPending && !!session?.user,
      staleTime: 30000,
      retry: 2,
      retryDelay: 1000,
      select: (sessions) => {
        if (!sessions?.length) return []
        const mappedSessions = sessions.map((sessionItem) => {
          const { browser, device } = parseUserAgent(sessionItem.userAgent)
          const location = getLocationFromIp(sessionItem.ipAddress)
          const lastActive = sessionItem.updatedAt
            ? new Date(sessionItem.updatedAt)
            : new Date(sessionItem.createdAt)
          const sessionId = sessionItem.id ?? sessionItem.token

          return {
            id: sessionId,
            token: sessionItem.token,
            device,
            browser,
            location,
            lastActive,
            isCurrent: sessionId === currentSessionId,
          }
        })
        
        return mappedSessions.sort((a, b) => {
          if (a.isCurrent && !b.isCurrent) return -1
          if (!a.isCurrent && b.isCurrent) return 1
          return 0
        })
      },
    },
  })
}

export function useRevokeSession() {
  const queryClient = useQueryClient()

  return usePostApiAuthRevokeSession({
    mutation: {
      onSuccess: (_, variables) => {
        queryClient.setQueryData<SessionInfo[]>(
          getListUserSessionsQueryKey(),
          (current) => current?.filter((session) => session.token !== variables.data.token) ?? current
        )
        queryClient.invalidateQueries({ queryKey: getListUserSessionsQueryKey() })
      },
    },
  })
}

export function useRevokeOtherSessions() {
  const queryClient = useQueryClient()

  return usePostApiAuthRevokeOtherSessions({
    mutation: {
      onSuccess: () => {
        queryClient.setQueryData<SessionInfo[]>(
          getListUserSessionsQueryKey(),
          (current) => current?.filter((session) => session.isCurrent) ?? current
        )
        queryClient.invalidateQueries({ queryKey: getListUserSessionsQueryKey() })
      },
    },
  })
}
