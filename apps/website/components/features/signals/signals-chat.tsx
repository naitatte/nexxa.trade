"use client"

import { useEffect, useState } from "react"
import type { ChangeEvent } from "react"
import { Search, Menu } from "lucide-react"
import { format } from "date-fns"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { getApiBaseUrl } from "@/lib/api/base-url"
import { useGetApiSignalsChannels, useGetApiSignalsChannelsChannelIdMessages } from "@/lib/api/signals/signals"
import type { Def24, Def25, Def26 } from "@/lib/api/generated.schemas"

type SignalChannel = Def26
type SignalMessage = Def25
type SignalMessagePreview = Def24
type SignalAttachment = SignalMessage["attachments"][number]

type SignalStreamEvent = {
  readonly type: "message"
  readonly channelId: string
  readonly message: SignalMessage
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
  return message.content ?? "Message"
}

const buildWebSocketUrl = (baseUrl: string, channelId: string): string => {
  const trimmed: string = baseUrl.replace(/\/$/, "")
  const wsBase: string = trimmed.startsWith("https") ? trimmed.replace(/^https/, "wss") : trimmed.replace(/^http/, "ws")
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
  const record = parsed as { type?: unknown; channelId?: unknown; message?: unknown }
  if (record.type !== "message" || typeof record.channelId !== "string") {
    return null
  }
  if (!record.message || typeof record.message !== "object") {
    return null
  }
  return { type: "message", channelId: record.channelId, message: record.message as SignalMessage }
}

export function SignalsChat() {
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)
  const [messages, setMessages] = useState<SignalMessage[]>([])
  const [search, setSearch] = useState<string>("")
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false)
  const [isClosing, setIsClosing] = useState<boolean>(false)
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
  useEffect((): void => {
    if (selectedChannelId || !channels.length) {
      return
    }
    setSelectedChannelId(channels[0].id)
  }, [channels, selectedChannelId])
  useEffect((): void => {
    if (messagesQuery.data?.items) {
      setMessages(messagesQuery.data.items)
      return
    }
    if (!activeChannelId) {
      setMessages([])
    }
  }, [messagesQuery.data, activeChannelId])
  useEffect((): void | (() => void) => {
    if (!isClosing) {
      return
    }
    const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
      setIsMobileOpen(false)
      setIsClosing(false)
    }, 200)
    return () => clearTimeout(timer)
  }, [isClosing])
  useEffect((): void | (() => void) => {
    if (!activeChannelId) {
      return
    }
    const baseUrl: string = getApiBaseUrl()
    const wsUrl: string = buildWebSocketUrl(baseUrl, activeChannelId)
    const socket: WebSocket = new WebSocket(wsUrl)
    socket.onmessage = (event: MessageEvent<string>) => {
      const parsed: SignalStreamEvent | null = parseSignalStreamEvent(event.data)
      if (!parsed || parsed.channelId !== activeChannelId) {
        return
      }
      setMessages((prev: SignalMessage[]) => {
        const exists: boolean = prev.some((item: SignalMessage) => item.id === parsed.message.id)
        if (exists) {
          return prev
        }
        return [...prev, parsed.message]
      })
    }
    return () => {
      socket.close()
    }
  }, [activeChannelId])
  const handleCloseSidebar = (): void => {
    setIsClosing(true)
  }
  const handleSelectChannel = (channelId: string): void => {
    setSelectedChannelId(channelId)
    setIsMobileOpen(false)
  }
  const ChatList = () => (
    <>
      <div className="p-4 border-b flex items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search signals..."
            className="pl-9 bg-background"
            value={search}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)}
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
              onClick={() => handleSelectChannel(channel.id)}
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
  return (
    <div className="flex h-full w-full overflow-hidden rounded-xl border bg-background shadow-sm relative">
      <div className="w-80 flex-shrink-0 border-r bg-muted/10 md:flex flex-col hidden">
        <ChatList />
      </div>
      {(isMobileOpen || isClosing) && (
        <div className="absolute inset-0 z-50 flex md:hidden">
          <div
            className={cn(
              "w-80 bg-background border-r shadow-xl flex flex-col h-full duration-200",
              isClosing ? "animate-out slide-out-to-left" : "animate-in slide-in-from-left"
            )}
          >
            <ChatList />
          </div>
          <div
            className={cn(
              "flex-1 bg-black/20 backdrop-blur-sm duration-200",
              isClosing ? "animate-out fade-out" : "animate-in fade-in"
            )}
            onClick={handleCloseSidebar}
          />
        </div>
      )}
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
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6 bg-muted/5">
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
            return (
              <div key={message.id} className="flex gap-3 max-w-[85%] lg:max-w-[75%]">
                <Avatar className="h-8 w-8 flex-shrink-0 mt-1 hidden sm:block bg-accent">
                  <AvatarFallback className="bg-accent">{selectedChannel?.name?.[0] ?? "S"}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start gap-1">
                  {message.type === "image" && message.attachments.length > 0 && (
                    <div className="space-y-1">
                      {message.attachments.map((attachment: SignalAttachment) => (
                        <img
                          key={attachment.id}
                          src={attachment.url}
                          alt={attachment.fileName ?? "Signal image"}
                          className="rounded-lg max-w-[260px] border shadow-sm"
                        />
                      ))}
                    </div>
                  )}
                  {((message.type === "image" && message.content) || message.type !== "image") && (
                    <div className="px-4 py-3 rounded-2xl text-sm shadow-sm bg-card border rounded-bl-none">
                      {message.type === "text" && message.content && (
                        <p className="whitespace-pre-line leading-relaxed">{message.content}</p>
                      )}
                      {message.type === "image" && message.content && (
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
                      {message.type !== "text" && message.type !== "image" && message.type !== "audio" && message.type !== "link" && message.content && (
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
    </div>
  )
}
