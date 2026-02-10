"use client"

import { useCallback, useEffect, useState, useRef, type RefObject } from "react"
import type { ChangeEvent } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Search, Menu, Play, Reply } from "lucide-react"
import { format } from "date-fns"
import Lightbox from "yet-another-react-lightbox"
import type { Slide } from "yet-another-react-lightbox"
import Video from "yet-another-react-lightbox/plugins/video"
import "yet-another-react-lightbox/styles.css"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Skeleton } from "@/components/ui/skeleton"
import { RoleGuard } from "@/components/features/auth/permissions/role-guard"
import { cn } from "@/lib/utils"
import { getApiBaseUrl } from "@/lib/api/base-url"
import { getApiSignalsChannelsChannelIdMessages, getGetApiSignalsChannelsQueryKey, useGetApiSignalsChannels, useGetApiSignalsChannelsChannelIdMessages } from "@/lib/api/signals/signals"
import type { Def27, Def29, Def30, Def31, Def32, Def34 } from "@/lib/api/generated.schemas"

type SignalChannel = Def32
type SignalMessage = Def31
type SignalMessagePreview = Def29
type SignalReplyPreview = Def30
type SignalAttachment = SignalMessage["attachments"][number]
type SignalMessageList = Def34
type MediaKind = "image" | "video"
type SignalStreamEvent =
  | {
      readonly type: "message"
      readonly channelId: string
      readonly message: SignalMessage
    }
  | {
      readonly type: "message_edit"
      readonly channelId: string
      readonly message: SignalMessage
    }
  | {
      readonly type: "channel_upsert"
      readonly channel: SignalChannel
    }
  | {
      readonly type: "message_delete"
      readonly messageIds: string[]
    }

const formatTime = (value: string): string => {
  const date: Date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ""
  }
  return format(date, "h:mm a")
}

const getPreviewText = (message: SignalMessagePreview | undefined): string => {
  if (!message) {
    return "No messages yet"
  }
  if (message.type === "image") {
    return "Image"
  }
  if (message.type === "audio") {
    return "Audio"
  }
  if (message.type === "link") {
    return "Link"
  }
  if (message.type === "video") {
    return "Video"
  }
  return message.content ?? "Message"
}

const buildWebSocketUrl = (baseUrl: string, channelId?: string): string => {
  const trimmed: string = baseUrl.replace(/\/$/, "")
  const wsBase: string = trimmed.startsWith("https") ? trimmed.replace(/^https/, "wss") : trimmed.replace(/^http/, "ws")
  if (!channelId) {
    return `${wsBase}/api/signals/stream`
  }
  return `${wsBase}/api/signals/stream?channelId=${encodeURIComponent(channelId)}`
}

const parseSignalStreamEvent = (data: string): SignalStreamEvent | null => {
  if (!data) {
    return null
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(data)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== "object") {
    return null
  }
  const record = parsed as { type?: unknown; channelId?: unknown; message?: unknown; messageIds?: unknown; channel?: unknown }
  if (record.type === "message" || record.type === "message_edit") {
    if (typeof record.channelId !== "string") {
      return null
    }
    if (!record.message || typeof record.message !== "object") {
      return null
    }
    return { type: record.type, channelId: record.channelId, message: record.message as SignalMessage }
  }
  if (record.type === "message_delete") {
    if (!Array.isArray(record.messageIds)) {
      return null
    }
    const messageIds: string[] = record.messageIds.filter((item: unknown): item is string => typeof item === "string")
    if (!messageIds.length) {
      return null
    }
    return { type: "message_delete", messageIds }
  }
  if (record.type === "channel_upsert") {
    if (!record.channel || typeof record.channel !== "object") {
      return null
    }
    return { type: "channel_upsert", channel: record.channel as SignalChannel }
  }
  return null
}

const getAttachmentMediaKind = (attachment: SignalAttachment): MediaKind | null => {
  if (attachment.type === "video") {
    return "video"
  }
  if (attachment.type === "image") {
    return "image"
  }
  const mimeType: string = attachment.mimeType ?? ""
  if (mimeType.startsWith("video/")) {
    return "video"
  }
  if (mimeType.startsWith("image/")) {
    return "image"
  }
  if (attachment.fileName && /\.(mp4|mov|webm|m4v)$/i.test(attachment.fileName)) {
    return "video"
  }
  return null
}

const buildThumbnailUrl = (videoUrl: string): string => {
  const url = new URL(videoUrl)
  const pathname = url.pathname
  const thumbnailPath = pathname.replace(/\.(mp4|mov|webm|m4v|avi|mkv)$/i, ".jpg")
  return `${url.origin}${thumbnailPath}`
}

const buildLightboxSlides = (attachments: SignalAttachment[]): Slide[] => {
  return attachments
    .map((attachment: SignalAttachment): Slide | null => {
      const kind: MediaKind | null = getAttachmentMediaKind(attachment)
      if (!kind) {
        return null
      }
      if (kind === "image") {
        return { src: attachment.url }
      }
      const sourceType = attachment.mimeType ?? "video/mp4"
      return {
        type: "video",
        sources: [{ src: attachment.url, type: sourceType }],
      }
    })
    .filter((slide: Slide | null): slide is Slide => Boolean(slide))
}

type VideoPreviewProps = {
  readonly attachment: SignalAttachment
  readonly onClick: () => void
}

function VideoPreview({ attachment, onClick }: VideoPreviewProps) {
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false)
  const [thumbnailError, setThumbnailError] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLButtonElement>(null)
  const thumbnailUrl = buildThumbnailUrl(attachment.url)

  useEffect(() => {
    if (!containerRef.current) {
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setShouldLoadVideo(true)
        }
      },
      { rootMargin: "200px" }
    )
    observer.observe(containerRef.current)
    return () => {
      observer.disconnect()
    }
  }, [])

  const handleMouseEnter = () => {
    setShouldLoadVideo(true)
  }

  return (
    <button
      ref={containerRef}
      type="button"
      className="group relative block"
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
    >
      {shouldLoadVideo ? (
        <video
          ref={videoRef}
          className="rounded-lg max-w-[320px] border shadow-sm"
          preload="none"
          muted
          playsInline
          poster={!thumbnailError ? thumbnailUrl : undefined}
        >
          <source src={attachment.url} type={attachment.mimeType ?? undefined} />
        </video>
      ) : (
        <div className="rounded-lg max-w-[320px] border shadow-sm aspect-video relative overflow-hidden">
          {!thumbnailError ? (
            <img
              src={thumbnailUrl}
              alt="Video preview"
              className="w-full h-full object-cover"
              onError={() => setThumbnailError(true)}
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <Play className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
        </div>
      )}
      <div className="absolute inset-0 flex items-center justify-center rounded-lg pointer-events-none">
        <Play className="h-10 w-10 text-white drop-shadow-lg" />
      </div>
    </button>
  )
}

const getReplyPreviewText = (reply: SignalReplyPreview): string => {
  if (reply.type === "image") {
    return reply.content ?? "Image"
  }
  if (reply.type === "audio") {
    return reply.content ?? "Audio"
  }
  if (reply.type === "video") {
    return reply.content ?? "Video"
  }
  if (reply.type === "link") {
    return reply.content ?? "Link"
  }
  return reply.content ?? "Message"
}

type ReplyBadgeProps = {
  readonly reply: SignalReplyPreview
  readonly onScrollTo: (messageId: string) => void
}

function ReplyBadge({ reply, onScrollTo }: ReplyBadgeProps) {
  const previewText: string = getReplyPreviewText(reply)
  return (
    <button
      type="button"
      className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 hover:bg-muted/60 border border-transparent hover:border-border/40 transition-all mb-1.5 rounded-md px-2.5 py-1.5 max-w-full group w-fit select-none"
      onClick={() => onScrollTo(reply.id)}
    >
      <Reply className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70 group-hover:text-primary transition-colors" />
      <span className="truncate max-w-[240px] text-muted-foreground group-hover:text-foreground transition-colors">
        {previewText}
      </span>
    </button>
  )
}

type ChatListProps = {
  readonly channels: SignalChannel[]
  readonly filteredChannels: SignalChannel[]
  readonly selectedChannel: SignalChannel | null
  readonly search: string
  readonly onSearchChange: (value: string) => void
  readonly onSelectChannel: (channelId: string) => void
}

function ChatList({ channels, filteredChannels, selectedChannel, search, onSearchChange, onSelectChannel }: ChatListProps) {
  return (
    <>
      <div className="h-16 px-4 border-b flex items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search signals..."
            className="pl-9 bg-background"
            value={search}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onSearchChange(event.target.value)}
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {!channels.length && (
          <div className="px-3 py-4 text-sm text-muted-foreground">No channels yet.</div>
        )}
        {filteredChannels.map((channel: SignalChannel) => {
          const lastMessage: SignalMessagePreview | undefined = channel.lastMessage
          const previewText: string = getPreviewText(lastMessage)
          const previewTime: string = lastMessage ? formatTime(lastMessage.createdAt) : ""
          return (
            <div
              key={channel.id}
              onClick={() => onSelectChannel(channel.id)}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-muted/50",
                selectedChannel?.id === channel.id ? "bg-muted" : ""
              )}
            >
              <div className="relative">
                <Avatar className="bg-accent">
                  <AvatarImage src={channel.avatarUrl ?? undefined} />
                  <AvatarFallback className="bg-accent">{channel.name[0]}</AvatarFallback>
                </Avatar>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-medium truncate text-sm">{channel.name}</span>
                  {previewTime && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">{previewTime}</span>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-xs text-muted-foreground truncate max-w-[140px]">{previewText}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

export function SignalsChat() {
  const queryClient = useQueryClient()
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)
  const [messages, setMessages] = useState<SignalMessage[]>([])
  const [search, setSearch] = useState<string>("")
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false)
  const [lightboxSlides, setLightboxSlides] = useState<Slide[]>([])
  const [lightboxIndex, setLightboxIndex] = useState<number>(0)
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [isLoadingOlder, setIsLoadingOlder] = useState<boolean>(false)
  const scrollContainerRef: RefObject<HTMLDivElement | null> = useRef<HTMLDivElement>(null)
  const sentinelRef: RefObject<HTMLDivElement | null> = useRef<HTMLDivElement>(null)
  const isInitialLoadRef = useRef<boolean>(true)
  const channelsQuery = useGetApiSignalsChannels()
  const channels: SignalChannel[] = channelsQuery.data?.channels ?? []
  const isLoadingChannels: boolean = (channelsQuery as unknown as { isPending?: boolean; isLoading?: boolean }).isPending ?? (channelsQuery as unknown as { isPending?: boolean; isLoading?: boolean }).isLoading ?? false
  const isErrorChannels: boolean = channelsQuery.isError ?? false
  const filteredChannels: SignalChannel[] = channels.filter((channel: SignalChannel) => channel.name.toLowerCase().includes(search.trim().toLowerCase()))
  const selectedChannel: SignalChannel | null = channels.find((channel: SignalChannel) => channel.id === selectedChannelId) ?? (channels[0] ?? null)
  const activeChannelId: string | null = selectedChannel?.id ?? null
  const messagesQuery = useGetApiSignalsChannelsChannelIdMessages(activeChannelId ?? "", { limit: 50 }, { query: { enabled: !!activeChannelId } })
  const isLoadingMessages: boolean = (messagesQuery as unknown as { isPending?: boolean; isLoading?: boolean }).isPending ?? (messagesQuery as unknown as { isPending?: boolean; isLoading?: boolean }).isLoading ?? false
  const isErrorMessages: boolean = messagesQuery.isError ?? false
  const upsertChannel = useCallback((channel: SignalChannel): void => {
    const queryKey = getGetApiSignalsChannelsQueryKey()
    queryClient.setQueryData<{ channels: SignalChannel[] }>(queryKey, (current) => {
      const existing: SignalChannel[] = current?.channels ?? []
      const index: number = existing.findIndex((item: SignalChannel) => item.id === channel.id)
      if (index >= 0) {
        const next: SignalChannel[] = [...existing]
        next[index] = { ...next[index], ...channel }
        return { channels: next }
      }
      return { channels: [channel, ...existing] }
    })
  }, [queryClient])
  const invalidateChannels = useCallback((): void => {
    queryClient.invalidateQueries({ queryKey: getGetApiSignalsChannelsQueryKey() })
  }, [queryClient])
  useEffect((): void => {
    if (selectedChannelId || !channels.length) {
      return
    }
    setSelectedChannelId(channels[0].id)
  }, [channels, selectedChannelId])
  useEffect((): void => {
    if (messagesQuery.data) {
      const data: SignalMessageList = messagesQuery.data
      setMessages(data.items ?? [])
      setNextCursor(data.nextCursor ?? null)
      isInitialLoadRef.current = true
      return
    }
    if (!activeChannelId) {
      setMessages([])
      setNextCursor(null)
    }
  }, [messagesQuery.data, activeChannelId])
  useEffect((): void => {
    if (!isInitialLoadRef.current || !messages.length) {
      return
    }
    isInitialLoadRef.current = false
    const container: HTMLDivElement | null = scrollContainerRef.current
    if (!container) {
      return
    }
    container.scrollTop = container.scrollHeight
  }, [messages])
  const fetchOlderMessages = useCallback(async (): Promise<void> => {
    if (!activeChannelId || !nextCursor || isLoadingOlder) {
      return
    }
    setIsLoadingOlder(true)
    const container: HTMLDivElement | null = scrollContainerRef.current
    const previousScrollHeight: number = container?.scrollHeight ?? 0
    try {
      const data: SignalMessageList = await getApiSignalsChannelsChannelIdMessages(activeChannelId, { limit: 50, before: nextCursor })
      const olderItems: SignalMessage[] = data.items ?? []
      if (!olderItems.length) {
        setNextCursor(null)
        return
      }
      setNextCursor(data.nextCursor ?? null)
      setMessages((prev: SignalMessage[]) => {
        const existingIds: Set<string> = new Set(prev.map((m: SignalMessage) => m.id))
        const unique: SignalMessage[] = olderItems.filter((m: SignalMessage) => !existingIds.has(m.id))
        return [...unique, ...prev]
      })
      requestAnimationFrame(() => {
        if (!container) {
          return
        }
        container.scrollTop = container.scrollHeight - previousScrollHeight
      })
    } finally {
      setIsLoadingOlder(false)
    }
  }, [activeChannelId, nextCursor, isLoadingOlder])
  useEffect((): void | (() => void) => {
    const sentinel: HTMLDivElement | null = sentinelRef.current
    const container: HTMLDivElement | null = scrollContainerRef.current
    if (!sentinel || !container || !activeChannelId) {
      return
    }
    const observer: IntersectionObserver = new IntersectionObserver(
      (entries: IntersectionObserverEntry[]) => {
        if (!entries[0]?.isIntersecting) {
          return
        }
        fetchOlderMessages()
      },
      { root: container, rootMargin: "200px 0px 0px 0px", threshold: 0 }
    )
    observer.observe(sentinel)
    return () => {
      observer.disconnect()
    }
  }, [activeChannelId, fetchOlderMessages])
  useEffect((): void | (() => void) => {
    const baseUrl: string = getApiBaseUrl()
    const wsUrl: string = buildWebSocketUrl(baseUrl)
    const socket: WebSocket = new WebSocket(wsUrl)
    socket.onmessage = (event: MessageEvent<string>) => {
      const parsed: SignalStreamEvent | null = parseSignalStreamEvent(event.data)
      if (!parsed) {
        return
      }
      if (parsed.type === "channel_upsert") {
        upsertChannel(parsed.channel)
        return
      }
      if (parsed.type === "message_delete") {
        invalidateChannels()
      }
    }
    return () => {
      socket.close()
    }
  }, [invalidateChannels, upsertChannel])
  useEffect((): void | (() => void) => {
    if (!activeChannelId) {
      return
    }
    const baseUrl: string = getApiBaseUrl()
    const wsUrl: string = buildWebSocketUrl(baseUrl, activeChannelId)
    const socket: WebSocket = new WebSocket(wsUrl)
    socket.onmessage = (event: MessageEvent<string>) => {
      const parsed: SignalStreamEvent | null = parseSignalStreamEvent(event.data)
      if (!parsed) {
        return
      }
      if (parsed.type === "channel_upsert") {
        upsertChannel(parsed.channel)
        return
      }
      if (parsed.type === "message_delete") {
        invalidateChannels()
        setMessages((prev: SignalMessage[]) => prev.filter((item: SignalMessage) => !parsed.messageIds.includes(item.id)))
        return
      }
      if (parsed.channelId !== activeChannelId) {
        return
      }
      const container: HTMLDivElement | null = scrollContainerRef.current
      const wasNearBottom: boolean = container
        ? container.scrollHeight - container.scrollTop - container.clientHeight < 150
        : true
      setMessages((prev: SignalMessage[]) => {
        const index: number = prev.findIndex((item: SignalMessage) => item.id === parsed.message.id)
        if (index >= 0) {
          const next: SignalMessage[] = [...prev]
          next[index] = parsed.message
          return next
        }
        return [...prev, parsed.message]
      })
      if (wasNearBottom) {
        requestAnimationFrame(() => {
          if (!container) {
            return
          }
          container.scrollTop = container.scrollHeight
        })
      }
    }
    return () => {
      socket.close()
    }
  }, [activeChannelId, invalidateChannels, upsertChannel])
  const handleCloseSidebar = (): void => {
    setIsMobileOpen(false)
  }
  const handleSelectChannel = (channelId: string): void => {
    setSelectedChannelId(channelId)
    setIsMobileOpen(false)
    setNextCursor(null)
    setIsLoadingOlder(false)
    isInitialLoadRef.current = true
  }
  const handleSearchChange = (value: string): void => {
    setSearch(value)
  }
  const openLightbox = (slides: Slide[], index: number): void => {
    if (!slides.length) {
      return
    }
    setLightboxSlides(slides)
    setLightboxIndex(index)
    setIsLightboxOpen(true)
  }
  const scrollToMessage = useCallback((messageId: string): void => {
    const element: HTMLElement | null = document.getElementById(`signal-msg-${messageId}`)
    if (!element) {
      return
    }
    element.scrollIntoView({ behavior: "smooth", block: "center" })
    element.classList.add("bg-primary/10")
    setTimeout(() => {
      element.classList.remove("bg-primary/10")
    }, 1500)
  }, [])
  return (
    <RoleGuard
      allowedRoles={["admin", "subscriber", "networker"]}
      requireActive
      fallback={(
        <div className="flex h-full w-full items-center justify-center rounded-xl border bg-muted/10 p-6 text-sm text-muted-foreground">
          Active membership required to access signals.
        </div>
      )}
    >
      <div className="flex h-full w-full overflow-hidden rounded-xl border bg-background shadow-sm relative">
      <div className="w-80 flex-shrink-0 border-r bg-muted/10 md:flex flex-col hidden">
        <ChatList
          channels={channels}
          filteredChannels={filteredChannels}
          selectedChannel={selectedChannel}
          search={search}
          onSearchChange={handleSearchChange}
          onSelectChannel={handleSelectChannel}
        />
      </div>
      <div
        className={cn(
          "absolute inset-0 z-50 flex md:hidden transition-[visibility] duration-200",
          isMobileOpen ? "visible" : "invisible"
        )}
      >
        <div
          className={cn(
            "w-80 bg-background border-r shadow-xl flex flex-col h-full transition-transform duration-200 ease-in-out",
            isMobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <ChatList
            channels={channels}
            filteredChannels={filteredChannels}
            selectedChannel={selectedChannel}
            search={search}
            onSearchChange={handleSearchChange}
            onSelectChannel={handleSelectChannel}
          />
        </div>
        <div
          className={cn(
            "flex-1 bg-black/20 backdrop-blur-sm transition-opacity duration-200",
            isMobileOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={handleCloseSidebar}
        />
      </div>
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        <div className="h-16 border-b flex items-center justify-between px-4 lg:px-6 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-3 lg:gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden -ml-2"
              onClick={() => setIsMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Avatar className="h-8 w-8 lg:h-10 lg:w-10 bg-accent">
              <AvatarImage src={selectedChannel?.avatarUrl ?? undefined} />
              <AvatarFallback className="bg-accent">{selectedChannel?.name?.[0] ?? "S"}</AvatarFallback>
            </Avatar>
            <h3 className="font-semibold text-base leading-none tracking-tight">
              {selectedChannel?.name ?? (isLoadingChannels ? "Loading..." : isErrorChannels ? "Error" : channels.length === 0 ? "No channel selected" : "Signals")}
            </h3>
          </div>
        </div>
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto no-scrollbar p-4 lg:p-6 space-y-6 bg-muted/5">
          {activeChannelId && !isLoadingMessages && !isErrorMessages && messages.length > 0 && (
            <div ref={sentinelRef} className="flex items-center justify-center py-2">
              {isLoadingOlder && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Spinner className="size-3" />
                  Loading older messages...
                </div>
              )}
            </div>
          )}
          {!activeChannelId && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">Select a channel to view messages</p>
              </div>
            </div>
          )}
          {activeChannelId && isLoadingMessages && (
            <div className="flex items-center justify-center h-full">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner className="size-4" />
                Loading messages...
              </div>
            </div>
          )}
          {activeChannelId && isErrorMessages && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-2">
                <p className="text-sm text-destructive">Failed to load messages. Please try again.</p>
              </div>
            </div>
          )}
          {activeChannelId && !isLoadingMessages && !isErrorMessages && !messages.length && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">No messages yet.</p>
              </div>
            </div>
          )}
          {activeChannelId && !isLoadingMessages && !isErrorMessages && messages.map((message: SignalMessage) => {
            const timestamp: string = message.sourceTimestamp ?? message.createdAt
            const mediaAttachments: SignalAttachment[] = message.attachments.filter((attachment: SignalAttachment) => Boolean(getAttachmentMediaKind(attachment)))
            const lightboxMediaSlides: Slide[] = buildLightboxSlides(mediaAttachments)
            const showTextBubble: boolean = (message.type === "image" || message.type === "video")
              ? Boolean(message.content)
              : true
            return (
              <div key={message.id} id={`signal-msg-${message.id}`} className="flex gap-3 max-w-[85%] lg:max-w-[75%] rounded-lg transition-colors duration-700">
                <Avatar className="h-8 w-8 flex-shrink-0 mt-1 hidden sm:block bg-accent">
                  <AvatarImage src={selectedChannel?.avatarUrl ?? undefined} />
                  <AvatarFallback className="bg-accent">{selectedChannel?.name?.[0] ?? "S"}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start gap-1">
                  {message.replyTo && (
                    <ReplyBadge reply={message.replyTo} onScrollTo={scrollToMessage} />
                  )}
                  {mediaAttachments.length > 0 && (
                    <div className="space-y-2">
                      {mediaAttachments.map((attachment: SignalAttachment, index: number) => {
                        const kind: MediaKind | null = getAttachmentMediaKind(attachment)
                        if (kind === "image") {
                          return (
                            <button
                              key={attachment.id}
                              type="button"
                              className="group block"
                              onClick={() => openLightbox(lightboxMediaSlides, index)}
                            >
                              <img
                                src={attachment.url}
                                alt={attachment.fileName ?? "Signal image"}
                                className="rounded-lg max-w-[260px] border shadow-sm transition group-hover:brightness-90"
                              />
                            </button>
                          )
                        }
                        if (kind === "video") {
                          return (
                            <VideoPreview
                              key={attachment.id}
                              attachment={attachment}
                              onClick={() => openLightbox(lightboxMediaSlides, index)}
                            />
                          )
                        }
                        return null
                      })}
                    </div>
                  )}
                  {showTextBubble && (
                    <div className="px-4 py-3 rounded-2xl text-sm shadow-sm bg-card border rounded-bl-none">
                      {message.type === "text" && message.content && (
                        <p className="whitespace-pre-line leading-relaxed">{message.content}</p>
                      )}
                      {(message.type === "image" || message.type === "video") && message.content && (
                        <p className="whitespace-pre-line leading-relaxed">{message.content}</p>
                      )}
                      {message.type === "audio" && message.attachments.length > 0 && (
                        <div className="space-y-2">
                          {message.attachments.map((attachment: SignalAttachment) => (
                            <audio key={attachment.id} controls className="w-full">
                              <source src={attachment.url} />
                            </audio>
                          ))}
                          {message.content && (
                            <p className="whitespace-pre-line leading-relaxed">{message.content}</p>
                          )}
                        </div>
                      )}
                      {message.type === "link" && message.link && (
                        <div className="space-y-2">
                          <a
                            href={message.link.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block rounded-lg border bg-background p-3 hover:bg-muted/40 transition"
                          >
                            {message.link.imageUrl && (
                              <img
                                src={message.link.imageUrl}
                                alt={message.link.title ?? "Link preview"}
                                className="rounded-md mb-2 max-w-[260px]"
                              />
                            )}
                            <div className="text-sm font-medium">
                              {message.link.title ?? message.link.url}
                            </div>
                            {message.link.description && (
                              <div className="text-xs text-muted-foreground mt-1">{message.link.description}</div>
                            )}
                            {message.link.siteName && (
                              <div className="text-[10px] text-muted-foreground mt-2">{message.link.siteName}</div>
                            )}
                          </a>
                          {message.content && (
                            <p className="whitespace-pre-line leading-relaxed">{message.content}</p>
                          )}
                        </div>
                      )}
                      {message.type !== "text" && message.type !== "image" && message.type !== "audio" && message.type !== "link" && message.type !== "video" && message.content && (
                        <p className="whitespace-pre-line leading-relaxed">{message.content}</p>
                      )}
                    </div>
                  )}
                  <span className="text-[10px] text-muted-foreground px-1">
                    {formatTime(timestamp)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <Lightbox
        open={isLightboxOpen}
        close={() => setIsLightboxOpen(false)}
        index={lightboxIndex}
        slides={lightboxSlides}
        plugins={[Video]}
      />
      </div>
    </RoleGuard>
  )
}
