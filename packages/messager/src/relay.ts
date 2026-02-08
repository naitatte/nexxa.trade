import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import http from "node:http";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import dotenv from "dotenv";
import input from "input";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { NewMessage } from "telegram/events/index.js";
import { EditedMessage, EditedMessageEvent } from "telegram/events/EditedMessage.js";
import { DeletedMessage, DeletedMessageEvent } from "telegram/events/DeletedMessage.js";
import { Api } from "telegram/tl/index.js";

const execAsync = promisify(exec);

dotenv.config();

type SignalIngestAttachmentInput = {
  readonly type: "image" | "audio" | "video";
  readonly url: string;
  readonly mimeType?: string | null;
  readonly fileName?: string | null;
  readonly size?: number | null;
  readonly width?: number | null;
  readonly height?: number | null;
  readonly durationSeconds?: number | null;
};

type SignalIngestLinkInput = {
  readonly url: string;
  readonly title?: string | null;
  readonly description?: string | null;
  readonly imageUrl?: string | null;
  readonly siteName?: string | null;
};

type SignalIngestMessageInput = {
  readonly source?: string | null;
  readonly sourceId?: string | null;
  readonly type: "text" | "image" | "audio" | "link" | "video";
  readonly content?: string | null;
  readonly sourceTimestamp?: string | null;
  readonly replyToSourceId?: string | null;
  readonly attachments?: SignalIngestAttachmentInput[];
  readonly link?: SignalIngestLinkInput;
};

type SignalIngestChannelInput = {
  readonly source?: string | null;
  readonly sourceId?: string | null;
  readonly name?: string | null;
  readonly description?: string | null;
  readonly avatarUrl?: string | null;
  readonly isActive?: boolean | null;
  readonly sortOrder?: number | null;
};

type SignalIngestInput = {
  readonly channelId?: string | null;
  readonly channel?: SignalIngestChannelInput;
  readonly message: SignalIngestMessageInput;
};

type SignalEditInput = {
  readonly source: string;
  readonly sourceId: string;
  readonly content?: string | null;
  readonly attachments?: SignalIngestAttachmentInput[];
  readonly link?: SignalIngestLinkInput;
};

type SignalDeleteInput = {
  readonly source: string;
  readonly sourceIds: string[];
};

type Config = {
  readonly telegramApiId: number;
  readonly telegramApiHash: string;
  readonly telegramSession: string;
  readonly telegramPhone: string;
  readonly telegram2fa: string;
  readonly telegramListenChats: string[];
  readonly onlyForwarded: boolean;
  readonly interactiveAuth: boolean;
  readonly signalsApiUrl: string;
  readonly signalsIngestKey: string;
  readonly signalsSource: string;
  readonly requestTimeoutMs: number;
  readonly mediaRoot: string;
  readonly mediaRoute: string;
  readonly mediaPublicUrl: string;
  readonly mediaServerHost: string;
  readonly mediaServerPort: number;
  readonly syncLookbackHours: number;
  readonly channelAliases: Map<string, string>;
};

type PeerKey = `${"channel" | "chat" | "user" | "name"}:${string}`;
type GetEntityInput = Parameters<TelegramClient["getEntity"]>[0];
type GetMessagesInput = Parameters<TelegramClient["getMessages"]>[0];
type RawEntity = Awaited<ReturnType<TelegramClient["getEntity"]>>;
type ResolvedEntity = RawEntity extends Array<infer U> ? U : RawEntity;

type OriginDescriptor = {
  readonly key: PeerKey;
  readonly name: string;
  readonly fallbackName?: string | null;
  readonly messageId: string;
  readonly entity?: ResolvedEntity | null;
};

type ResolvedChat = {
  readonly key: PeerKey;
  readonly entity: GetMessagesInput;
  readonly name?: string | null;
};

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (!value) {
    return fallback;
  }
  return value.toLowerCase() === "true" || value === "1";
};

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const parseList = (value: string | undefined): string[] => {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const parseAliases = (value: string | undefined): Map<string, string> => {
  const entries = parseList(value);
  const map = new Map<string, string>();
  for (const entry of entries) {
    const [rawKey, ...rest] = entry.split("=");
    const name = rest.join("=").trim();
    if (!rawKey || !name) {
      continue;
    }
    const key = rawKey.trim();
    if (key.includes(":")) {
      map.set(key, name);
      continue;
    }
    const numeric = key.replace("-100", "").replace("-", "");
    if (/^\d+$/.test(numeric)) {
      map.set(`channel:${numeric}`, name);
    }
  }
  return map;
};

const normalizeId = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string" && value.length) {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value).toString();
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "object") {
    const record = value as { value?: unknown; toString?: () => string };
    const inner = record.value;
    if (typeof inner === "string" && inner.length) {
      return inner;
    }
    if (typeof inner === "number" && Number.isFinite(inner)) {
      return Math.trunc(inner).toString();
    }
    if (typeof inner === "bigint") {
      return inner.toString();
    }
    if (typeof record.toString === "function") {
      const text = record.toString();
      if (/^-?\d+$/.test(text)) {
        return text;
      }
    }
  }
  return null;
};

const buildPeerKeyFromPeer = (peer: unknown): PeerKey | null => {
  if (!peer || typeof peer !== "object") {
    return null;
  }
  const className = (peer as { className?: string }).className;
  if (className === "PeerChannel") {
    const id = normalizeId((peer as { channelId?: unknown }).channelId);
    return id ? `channel:${id}` : null;
  }
  if (className === "PeerChat") {
    const id = normalizeId((peer as { chatId?: unknown }).chatId);
    return id ? `chat:${id}` : null;
  }
  if (className === "PeerUser") {
    const id = normalizeId((peer as { userId?: unknown }).userId);
    return id ? `user:${id}` : null;
  }
  return null;
};

const buildPeerKeyFromEntity = (entity: unknown): PeerKey | null => {
  if (!entity || typeof entity !== "object") {
    return null;
  }
  const className = (entity as { className?: string }).className;
  const id = normalizeId((entity as { id?: unknown }).id);
  if (!id) {
    return null;
  }
  if (className && className.includes("Channel")) {
    return `channel:${id}`;
  }
  if (className && className.includes("Chat")) {
    return `chat:${id}`;
  }
  if (className && className.includes("User")) {
    return `user:${id}`;
  }
  return null;
};

const getEntityDisplayName = (entity: unknown): string | null => {
  if (!entity || typeof entity !== "object") {
    return null;
  }
  const record = entity as {
    title?: unknown;
    username?: unknown;
    firstName?: unknown;
    lastName?: unknown;
  };
  if (typeof record.title === "string" && record.title.trim().length) {
    return record.title.trim();
  }
  if (typeof record.username === "string" && record.username.trim().length) {
    return record.username.trim();
  }
  const first = typeof record.firstName === "string" ? record.firstName.trim() : "";
  const last = typeof record.lastName === "string" ? record.lastName.trim() : "";
  const full = `${first} ${last}`.trim();
  return full.length ? full : null;
};

const normalizeResolvedEntity = (value: unknown): ResolvedEntity | null => {
  if (!value) {
    return null;
  }
  if (Array.isArray(value)) {
    return (value[0] as ResolvedEntity) ?? null;
  }
  return value as ResolvedEntity;
};

const buildEntityCandidatesFromPeerKey = (key: PeerKey): string[] => {
  const [kind, rawId] = key.split(":");
  if (!rawId) {
    return [];
  }
  const id = rawId.trim();
  if (!id.length) {
    return [];
  }
  const candidates: string[] = [];
  if (kind === "channel") {
    if (id.startsWith("-100")) {
      candidates.push(id);
    } else {
      candidates.push(`-100${id}`, id);
    }
  } else if (kind === "chat") {
    if (id.startsWith("-")) {
      candidates.push(id);
    } else {
      candidates.push(`-${id}`, id);
    }
  } else if (kind === "user") {
    candidates.push(id);
  }
  return [...new Set(candidates)];
};

const resolveEntityFromPeerKey = async (
  client: TelegramClient,
  key: PeerKey
): Promise<ResolvedEntity | null> => {
  const candidates = buildEntityCandidatesFromPeerKey(key);
  for (const candidate of candidates) {
    try {
      const raw = await client.getEntity(candidate as unknown as GetEntityInput);
      const normalized = normalizeResolvedEntity(raw as unknown);
      if (normalized) {
        return normalized;
      }
    } catch {
      continue;
    }
  }
  return null;
};

const extractPhotoIdFromEntity = (entity: ResolvedEntity): string | null => {
  if (!entity || typeof entity !== "object") {
    return null;
  }
  const photo = (entity as { photo?: unknown }).photo;
  if (!photo || typeof photo !== "object") {
    return null;
  }
  return normalizeId((photo as { photoId?: unknown }).photoId);
};

const config: Config = {
  telegramApiId: parseNumber(process.env.TELEGRAM_API_ID, 0),
  telegramApiHash: process.env.TELEGRAM_API_HASH ?? "",
  telegramSession: process.env.TELEGRAM_SESSION_STRING ?? "",
  telegramPhone: process.env.TELEGRAM_PHONE_NUMBER ?? "",
  telegram2fa: process.env.TELEGRAM_2FA_PASSWORD ?? "",
  telegramListenChats: parseList(process.env.TELEGRAM_LISTEN_CHATS),
  onlyForwarded: parseBoolean(process.env.MESSAGER_ONLY_FORWARDED, false),
  interactiveAuth: parseBoolean(process.env.MESSAGER_INTERACTIVE, false),
  signalsApiUrl: process.env.SIGNALS_API_URL ?? "http://server:4000",
  signalsIngestKey: process.env.SIGNALS_INGEST_KEY ?? "",
  signalsSource: process.env.MESSAGER_SIGNAL_SOURCE ?? "telegram",
  requestTimeoutMs: parseNumber(process.env.MESSAGER_REQUEST_TIMEOUT_MS, 15000),
  mediaRoot: process.env.MESSAGER_MEDIA_ROOT ?? "/data",
  mediaRoute: process.env.MESSAGER_MEDIA_ROUTE ?? "/media",
  mediaPublicUrl: process.env.MESSAGER_PUBLIC_URL ?? "",
  mediaServerHost: process.env.MESSAGER_HOST ?? "0.0.0.0",
  mediaServerPort: parseNumber(process.env.MESSAGER_PORT, 4201),
  syncLookbackHours: parseNumber(process.env.MESSAGER_SYNC_LOOKBACK_HOURS, 48),
  channelAliases: parseAliases(process.env.MESSAGER_CHANNEL_ALIASES),
};

const peerNameCache = new Map<PeerKey, string>();
const peerAvatarCache = new Map<PeerKey, { url: string | null; photoId: string | null; updatedAt: number }>();
const AVATAR_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const validateConfig = (): void => {
  const missing: string[] = [];
  if (!config.telegramApiId) missing.push("TELEGRAM_API_ID");
  if (!config.telegramApiHash) missing.push("TELEGRAM_API_HASH");
  if (!config.telegramSession && !config.interactiveAuth) missing.push("TELEGRAM_SESSION_STRING or MESSAGER_INTERACTIVE=true");
  if (config.interactiveAuth && !config.telegramPhone && !config.telegramSession) {
    missing.push("TELEGRAM_PHONE_NUMBER (for interactive auth)");
  }
  if (!config.signalsApiUrl) missing.push("SIGNALS_API_URL");
  if (missing.length) {
    console.error("[messager] Missing required environment values:");
    missing.forEach((item) => console.error(`  - ${item}`));
    process.exit(1);
  }
};

const sanitizeRoute = (value: string): string => {
  if (!value.startsWith("/")) {
    return `/${value}`;
  }
  return value.replace(/\/$/, "");
};

const mediaRoute = sanitizeRoute(config.mediaRoute);

const buildMediaUrl = (relativePath: string): string => {
  if (!config.mediaPublicUrl) {
    return "";
  }
  const base = config.mediaPublicUrl.replace(/\/$/, "");
  return `${base}${mediaRoute}/${relativePath}`;
};

const resolveChannelAvatarUrl = async (
  client: TelegramClient,
  origin: OriginDescriptor
): Promise<string | null> => {
  if (!config.mediaPublicUrl) {
    return null;
  }
  const cached = peerAvatarCache.get(origin.key);
  const now = Date.now();
  if (cached && now - cached.updatedAt < AVATAR_CACHE_TTL_MS) {
    return cached.url;
  }
  const entity = origin.entity ?? await resolveEntityFromPeerKey(client, origin.key);
  if (!entity) {
    peerAvatarCache.set(origin.key, { url: null, photoId: null, updatedAt: now });
    return null;
  }
  const photoId = extractPhotoIdFromEntity(entity);
  if (!photoId) {
    peerAvatarCache.set(origin.key, { url: null, photoId: null, updatedAt: now });
    return null;
  }
  if (cached && cached.photoId === photoId && cached.url) {
    peerAvatarCache.set(origin.key, { ...cached, updatedAt: now });
    return cached.url;
  }
  const safeKey = origin.key.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `avatar-${safeKey}-${photoId}.jpg`;
  const dir = path.join(config.mediaRoot, "avatars");
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, fileName);
  try {
    await fs.access(filePath);
  } catch {
    try {
      const result = await client.downloadProfilePhoto(entity, { isBig: true, outputFile: filePath });
      if (Buffer.isBuffer(result) && result.length === 0) {
        peerAvatarCache.set(origin.key, { url: null, photoId: null, updatedAt: now });
        return null;
      }
    } catch (error) {
      console.warn(`[messager] Failed to download avatar for ${origin.key}:`, (error as Error).message);
      if (cached) {
        peerAvatarCache.set(origin.key, { ...cached, updatedAt: now });
        return cached.url;
      }
      return null;
    }
  }
  try {
    await fs.access(filePath);
  } catch {
    peerAvatarCache.set(origin.key, { url: null, photoId: null, updatedAt: now });
    return null;
  }
  const relativePath = path.relative(config.mediaRoot, filePath).replace(/\\/g, "/");
  const url = buildMediaUrl(relativePath);
  if (!url) {
    peerAvatarCache.set(origin.key, { url: null, photoId: null, updatedAt: now });
    return null;
  }
  peerAvatarCache.set(origin.key, { url, photoId, updatedAt: now });
  return url;
};

const startMediaServer = async (): Promise<http.Server> => {
  await fs.mkdir(config.mediaRoot, { recursive: true });
  const server = http.createServer(async (req, res) => {
    const reqUrl = req.url ?? "";
    if (reqUrl === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }
    if (!reqUrl.startsWith(mediaRoute + "/")) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("Not found");
      return;
    }
    const rawPath = reqUrl.slice(mediaRoute.length + 1);
    const safePath = path.normalize(decodeURIComponent(rawPath));
    if (safePath.includes("..")) {
      res.writeHead(400, { "content-type": "text/plain" });
      res.end("Invalid path");
      return;
    }
    const filePath = path.join(config.mediaRoot, safePath);
    try {
      await fs.access(filePath);
    } catch {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType =
      ext === ".jpg" || ext === ".jpeg"
        ? "image/jpeg"
        : ext === ".png"
        ? "image/png"
        : ext === ".webp"
        ? "image/webp"
        : ext === ".gif"
        ? "image/gif"
        : ext === ".mp3"
        ? "audio/mpeg"
        : ext === ".ogg"
        ? "audio/ogg"
        : ext === ".m4a"
        ? "audio/mp4"
        : "application/octet-stream";
    res.writeHead(200, { "content-type": contentType });
    createReadStream(filePath).pipe(res);
  });
  await new Promise<void>((resolve) => {
    server.listen(config.mediaServerPort, config.mediaServerHost, () => resolve());
  });
  console.log(`[messager] Media server listening on ${config.mediaServerHost}:${config.mediaServerPort}${mediaRoute}`);
  return server;
};

const authenticateUser = async (client: TelegramClient): Promise<string> => {
  console.log("[messager] Starting interactive Telegram auth...");
  await client.start({
    phoneNumber: config.telegramPhone,
    password: async () => {
      if (config.telegram2fa) {
        return config.telegram2fa;
      }
      return input.text("Enter Telegram 2FA password (if any): ");
    },
    phoneCode: async () => input.text("Enter the Telegram login code: "),
    onError: (err) => {
      console.error("[messager] Telegram auth error:", err.message);
      process.exit(1);
    },
  });
  const rawSession = client.session.save();
  const sessionString = typeof rawSession === "string" ? rawSession : "";
  console.log("[messager] Auth succeeded. Save this TELEGRAM_SESSION_STRING:");
  console.log(sessionString);
  return sessionString;
};

const resolveChatIdentifier = async (client: TelegramClient, identifier: string): Promise<unknown> => {
  if (/^-?\d+$/.test(identifier)) {
    const numeric = identifier.replace("-100", "").replace("-", "");
    const candidates = new Set<string>();
    candidates.add(identifier);
    if (numeric && numeric !== identifier) {
      candidates.add(numeric);
      if (!identifier.startsWith("-100")) {
        candidates.add(`-100${numeric}`);
      }
    }
    let lastError: unknown;
    for (const candidate of candidates) {
      try {
        return await client.getEntity(candidate as unknown as GetEntityInput);
      } catch (error) {
        lastError = error;
      }
    }
    try {
      const dialogs = await client.getDialogs();
      const found = dialogs.find((dialog) => {
        const entity = dialog.entity as { id?: unknown };
        const entityId = normalizeId(entity?.id);
        if (!entityId) return false;
        if (identifier.startsWith("-100")) {
          return entityId === identifier.slice(4) || `-100${entityId}` === identifier;
        }
        if (numeric && entityId === numeric) {
          return true;
        }
        return entityId === identifier || `-100${entityId}` === identifier;
      });
      if (found) {
        return found.entity;
      }
    } catch {
    }
    if (lastError) {
      throw lastError;
    }
    throw new Error(`Unable to resolve chat identifier: ${identifier}`);
  }
  const cleaned = identifier.startsWith("@") ? identifier.slice(1) : identifier;
  return client.getEntity(cleaned as unknown as GetEntityInput);
};

const deriveForwardedMessageId = (message: Api.Message): string => {
  const fallbackId = normalizeId((message as { id?: unknown }).id);
  return fallbackId ?? crypto.randomUUID();
};

const resolveOriginDescriptor = async (
  client: TelegramClient,
  message: Api.Message,
  fallbackPeerKey: PeerKey | null
): Promise<OriginDescriptor | null> => {
  const forward = (message as { fwdFrom?: Api.MessageFwdHeader; forward?: Api.MessageFwdHeader }).fwdFrom ??
    (message as { forward?: Api.MessageFwdHeader }).forward;
  const forwardRecord = forward as {
    fromId?: unknown;
    savedFromPeer?: unknown;
    fromName?: unknown;
    postAuthor?: unknown;
    channelId?: unknown;
    chatId?: unknown;
    userId?: unknown;
  } | null | undefined;
  const forwardName =
    (typeof forwardRecord?.fromName === "string" ? forwardRecord.fromName : null) ??
    (typeof forwardRecord?.postAuthor === "string" ? forwardRecord.postAuthor : null);
  let originPeer: unknown = null;
  let originKey: PeerKey | null = null;
  if (forwardRecord?.fromId) {
    originPeer = forwardRecord.fromId;
    originKey = buildPeerKeyFromPeer(originPeer);
  }
  if (!originKey && forwardRecord?.savedFromPeer) {
    originPeer = forwardRecord.savedFromPeer;
    originKey = buildPeerKeyFromPeer(originPeer);
  }
  if (!originKey && forwardRecord?.channelId) {
    const channelId = normalizeId(forwardRecord.channelId);
    if (channelId) {
      originKey = `channel:${channelId}`;
    }
  }
  if (!originKey && forwardRecord?.chatId) {
    const chatId = normalizeId(forwardRecord.chatId);
    if (chatId) {
      originKey = `chat:${chatId}`;
    }
  }
  if (!originKey && forwardRecord?.userId) {
    const userId = normalizeId(forwardRecord.userId);
    if (userId) {
      originKey = `user:${userId}`;
    }
  }
  if (!originKey && config.onlyForwarded) {
    return null;
  }
  if (!originKey) {
    originKey = fallbackPeerKey ?? null;
  }
  if (!originKey && forwardName) {
    const hashed = crypto.createHash("sha1").update(forwardName).digest("hex").slice(0, 12);
    originKey = `name:${hashed}`;
  }
  if (!originKey) {
    return null;
  }
  if (peerNameCache.has(originKey)) {
    return {
      key: originKey,
      name: peerNameCache.get(originKey) ?? originKey,
      fallbackName: forwardName,
      messageId: deriveForwardedMessageId(message),
      entity: null,
    };
  }
  let resolvedName: string | null = null;
  let resolvedKey: PeerKey = originKey;
  let resolvedEntity: ResolvedEntity | null = null;
  const resolveEntity = async (entityInput: GetEntityInput) => {
    try {
      const raw = await client.getEntity(entityInput as unknown as GetEntityInput);
      const normalized = normalizeResolvedEntity(raw as unknown);
      if (!normalized) {
        return;
      }
      resolvedEntity = normalized;
      resolvedName = getEntityDisplayName(normalized) ?? resolvedName;
      const keyFromEntity = buildPeerKeyFromEntity(normalized);
      if (keyFromEntity) {
        resolvedKey = keyFromEntity;
      }
    } catch (error) {
      console.warn("[messager] Failed to resolve forwarded entity:", (error as Error).message);
    }
  };
  if (originPeer) {
    await resolveEntity(originPeer as GetEntityInput);
  } else {
    const [kind, id] = originKey.split(":");
    if (id) {
      const candidates: string[] = [];
      if (kind === "channel" && !id.startsWith("-100")) {
        candidates.push(`-100${id}`, id);
      } else if (kind === "chat" && !id.startsWith("-")) {
        candidates.push(`-${id}`, id);
      } else {
        candidates.push(id);
      }
      for (const candidate of candidates) {
        await resolveEntity(candidate as unknown as GetEntityInput);
        if (resolvedName) {
          break;
        }
      }
    }
  }
  const alias =
    config.channelAliases.get(resolvedKey) ??
    config.channelAliases.get(originKey) ??
    config.channelAliases.get(resolvedKey.split(":")[1] ?? "");
  const name = alias ?? resolvedName ?? forwardName ?? resolvedKey;
  peerNameCache.set(resolvedKey, name);
  return {
    key: resolvedKey,
    name,
    fallbackName: forwardName,
    messageId: deriveForwardedMessageId(message),
    entity: resolvedEntity,
  };
};

const extractMessageText = (message: Api.Message): string | null => {
  const raw = (message as { rawText?: string; message?: string; text?: string }).rawText ??
    (message as { message?: string }).message ??
    (message as { text?: string }).text ??
    "";
  const trimmed = raw.trim();
  return trimmed.length ? trimmed : null;
};

const extractReplyToMessageId = (message: Api.Message): string | null => {
  const replyTo = (message as { replyTo?: { replyToMsgId?: unknown } }).replyTo;
  if (!replyTo) {
    return null;
  }
  return normalizeId(replyTo.replyToMsgId);
};

const extractSourceTimestamp = (message: Api.Message): string | null => {
  const forward = (message as { fwdFrom?: Api.MessageFwdHeader }).fwdFrom as { date?: unknown } | undefined;
  const forwardDate = typeof forward?.date === "number" ? forward.date : null;
  if (forwardDate) {
    return new Date(forwardDate * 1000).toISOString();
  }
  const messageDate = (message as { date?: unknown }).date;
  if (typeof messageDate === "number") {
    return new Date(messageDate * 1000).toISOString();
  }
  return null;
};

const extractWebPage = (message: Api.Message): SignalIngestLinkInput | null => {
  const media = (message as { media?: unknown }).media as { className?: string; webpage?: unknown } | undefined;
  if (!media || media.className !== "MessageMediaWebPage") {
    return null;
  }
  const webpage = media.webpage as {
    url?: unknown;
    displayUrl?: unknown;
    title?: unknown;
    description?: unknown;
    siteName?: unknown;
  } | undefined;
  const url = typeof webpage?.url === "string" && webpage.url.length
    ? webpage.url
    : typeof webpage?.displayUrl === "string"
      ? webpage.displayUrl
      : null;
  if (!url) {
    return null;
  }
  return {
    url,
    title: typeof webpage?.title === "string" ? webpage?.title ?? null : null,
    description: typeof webpage?.description === "string" ? webpage?.description ?? null : null,
    imageUrl: null,
    siteName: typeof webpage?.siteName === "string" ? webpage?.siteName ?? null : null,
  };
};

const getExtensionFromMime = (mimeType: string | null | undefined): string | null => {
  if (!mimeType) {
    return null;
  }
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "image/gif") return ".gif";
  if (mimeType === "audio/mpeg") return ".mp3";
  if (mimeType === "audio/ogg") return ".ogg";
  if (mimeType === "audio/mp4") return ".m4a";
  if (mimeType === "video/mp4") return ".mp4";
  if (mimeType === "video/quicktime") return ".mov";
  if (mimeType === "video/webm") return ".webm";
  if (mimeType === "video/x-m4v" || mimeType === "video/m4v") return ".m4v";
  return null;
};

const generateVideoThumbnail = async (
  videoPath: string,
  thumbnailPath: string,
  width: number = 320
): Promise<boolean> => {
  try {
    await execAsync(
      `ffmpeg -i "${videoPath}" -vf "scale=${width}:-1" -frames:v 1 -q:v 2 "${thumbnailPath}" -y`
    );
    return true;
  } catch (error) {
    console.warn(`[messager] Failed to generate thumbnail for ${videoPath}:`, (error as Error).message);
    return false;
  }
};

const extractInputFileLocation = (
  media: unknown
): { location: Api.TypeInputFileLocation; dcId: number } | null => {
  if (!media || typeof media !== "object") {
    return null;
  }
  const record = media as {
    className?: string;
    document?: {
      className?: string;
      id?: unknown;
      accessHash?: unknown;
      fileReference?: Buffer;
      dcId?: number;
    };
    photo?: {
      className?: string;
      id?: unknown;
      accessHash?: unknown;
      fileReference?: Buffer;
      dcId?: number;
      sizes?: unknown[];
    };
  };
  if (record.className === "MessageMediaDocument" && record.document) {
    const doc = record.document;
    if (
      doc.className === "Document" &&
      doc.id !== undefined &&
      doc.accessHash !== undefined &&
      doc.fileReference &&
      typeof doc.dcId === "number"
    ) {
      return {
        location: new Api.InputDocumentFileLocation({
          id: doc.id as Api.InputDocumentFileLocation["id"],
          accessHash: doc.accessHash as Api.InputDocumentFileLocation["accessHash"],
          fileReference: doc.fileReference,
          thumbSize: "",
        }),
        dcId: doc.dcId,
      };
    }
  }
  return null;
};

const downloadMediaAttachment = async (
  client: TelegramClient,
  message: Api.Message,
  type: "image" | "audio" | "video",
  fileName: string | null,
  mimeType: string | null,
  durationSeconds: number | null,
  width: number | null,
  height: number | null
): Promise<SignalIngestAttachmentInput | null> => {
  if (!config.mediaPublicUrl) {
    console.warn("[messager] Media found but MESSAGER_PUBLIC_URL is empty. Skipping attachment.");
    return null;
  }
  const media = (message as { media?: unknown }).media;
  if (!media) {
    return null;
  }
  const docLocation = extractInputFileLocation(media);
  let buffer: Buffer | string | undefined;
  if (docLocation) {
    buffer = await client.downloadFile(docLocation.location, {
      dcId: docLocation.dcId,
    });
  } else {
    buffer = await client.downloadMedia(media as Api.TypeMessageMedia, {});
  }
  if (!buffer || !Buffer.isBuffer(buffer)) {
    return null;
  }
  const ext = path.extname(fileName ?? "");
  const fallbackExt =
    ext ||
    getExtensionFromMime(mimeType) ||
    (type === "image" ? ".jpg" : type === "video" ? ".mp4" : ".ogg");
  const safeBaseName = fileName ? path.basename(fileName, ext) : type;
  const date = new Date();
  const dir = path.join(
    config.mediaRoot,
    `${date.getUTCFullYear()}`,
    `${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
    `${String(date.getUTCDate()).padStart(2, "0")}`
  );
  await fs.mkdir(dir, { recursive: true });
  const id = crypto.randomUUID();
  const safeFileName = `${safeBaseName}-${id}${fallbackExt}`;
  const filePath = path.join(dir, safeFileName);
  await fs.writeFile(filePath, buffer);
  const relativePath = path.relative(config.mediaRoot, filePath).replace(/\\/g, "/");
  const url = buildMediaUrl(relativePath);
  if (type === "video") {
    const thumbnailFileName = `${safeBaseName}-${id}.jpg`;
    const thumbnailPath = path.join(dir, thumbnailFileName);
    await generateVideoThumbnail(filePath, thumbnailPath, width ?? 320);
  }
  return {
    type,
    url,
    mimeType: mimeType ?? null,
    fileName: safeFileName,
    size: buffer.length,
    width: width ?? null,
    height: height ?? null,
    durationSeconds: durationSeconds ?? null,
  };
};

const extractDocumentInfo = (doc: { mimeType?: unknown; attributes?: unknown[] } | undefined) => {
  const mimeType = typeof doc?.mimeType === "string" ? doc.mimeType : null;
  const attrs = Array.isArray(doc?.attributes) ? doc?.attributes : [];
  const filenameAttr = attrs.find((attr) => (attr as { className?: string }).className === "DocumentAttributeFilename") as
    | { fileName?: unknown }
    | undefined;
  const audioAttr = attrs.find((attr) => (attr as { className?: string }).className === "DocumentAttributeAudio") as
    | { duration?: unknown; voice?: unknown }
    | undefined;
  const imageAttr = attrs.find((attr) => (attr as { className?: string }).className === "DocumentAttributeImageSize") as
    | { w?: unknown; h?: unknown }
    | undefined;
  const videoAttr = attrs.find((attr) => (attr as { className?: string }).className === "DocumentAttributeVideo") as
    | { w?: unknown; h?: unknown; duration?: unknown }
    | undefined;
  const durationSeconds = typeof audioAttr?.duration === "number"
    ? audioAttr.duration
    : typeof videoAttr?.duration === "number"
      ? videoAttr.duration
      : null;
  const width = typeof imageAttr?.w === "number"
    ? imageAttr.w
    : typeof videoAttr?.w === "number"
      ? videoAttr.w
      : null;
  const height = typeof imageAttr?.h === "number"
    ? imageAttr.h
    : typeof videoAttr?.h === "number"
      ? videoAttr.h
      : null;
  return {
    mimeType,
    fileName: typeof filenameAttr?.fileName === "string" ? filenameAttr.fileName : null,
    durationSeconds,
    isVoice: Boolean(audioAttr?.voice),
    width,
    height,
    isVideo: Boolean(videoAttr),
  };
};

const buildMessagePayload = async (
  client: TelegramClient,
  message: Api.Message
): Promise<{
  readonly type: "text" | "image" | "audio" | "link" | "video";
  readonly content: string | null;
  readonly attachments: SignalIngestAttachmentInput[];
  readonly link?: SignalIngestLinkInput;
}> => {
  const text = extractMessageText(message);
  const link = extractWebPage(message);
  if (link) {
    return { type: "link", content: text, attachments: [], link };
  }
  const media = (message as { media?: unknown }).media as { className?: string; document?: unknown } | undefined;
  if (!media) {
    return { type: "text", content: text, attachments: [] };
  }
  if (media.className === "MessageMediaPhoto") {
    const attachment = await downloadMediaAttachment(client, message, "image", "photo.jpg", "image/jpeg", null, null, null);
    if (attachment) {
      return { type: "image", content: text, attachments: [attachment] };
    }
    return { type: "text", content: text, attachments: [] };
  }
  if (media.className === "MessageMediaDocument") {
    const doc = media.document as { mimeType?: unknown; attributes?: unknown[] } | undefined;
    const info = extractDocumentInfo(doc);
    const isImage = info.mimeType?.startsWith("image/") ?? false;
    const isAudio = info.mimeType?.startsWith("audio/") ?? false;
    const isVideo = (info.mimeType?.startsWith("video/") ?? false) || info.isVideo;
    if (isImage) {
      const attachment = await downloadMediaAttachment(client, message, "image", info.fileName, info.mimeType, null, info.width, info.height);
      if (attachment) {
        return { type: "image", content: text, attachments: [attachment] };
      }
    }
    if (isAudio) {
      const attachment = await downloadMediaAttachment(client, message, "audio", info.fileName, info.mimeType, info.durationSeconds, null, null);
      if (attachment) {
        return { type: "audio", content: text, attachments: [attachment] };
      }
    }
    if (isVideo) {
      const attachment = await downloadMediaAttachment(client, message, "video", info.fileName, info.mimeType, info.durationSeconds, info.width, info.height);
      if (attachment) {
        return { type: "video", content: text, attachments: [attachment] };
      }
    }
  }
  return { type: "text", content: text, attachments: [] };
};

const shouldProcessMessage = (message: Api.Message): boolean => {
  const className = (message as { className?: string }).className;
  if (className && className !== "Message") {
    return false;
  }
  return true;
};

const postSignal = async (payload: SignalIngestInput): Promise<void> => {
  const url = new URL("/api/signals/ingest", config.signalsApiUrl).toString();
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (config.signalsIngestKey) {
    headers["x-signals-key"] = config.signalsIngestKey;
  }
  const body = JSON.stringify(payload);
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });
      if (response.ok) {
        return;
      }
      const text = await response.text();
      if (response.status === 401 || response.status === 403) {
        console.error(`[messager] Ingest unauthorized (${response.status}): ${text}`);
        return;
      }
      if (attempt < maxAttempts) {
        console.warn(`[messager] Ingest failed (${response.status}), retrying...`);
        await sleep(1000 * attempt);
        continue;
      }
      console.error(`[messager] Ingest failed (${response.status}): ${text}`);
      return;
    } catch (error) {
      clearTimeout(timeout);
      if (attempt < maxAttempts) {
        console.warn("[messager] Ingest error, retrying...", (error as Error).message);
        await sleep(1000 * attempt);
        continue;
      }
      console.error("[messager] Ingest error:", (error as Error).message);
      return;
    } finally {
      clearTimeout(timeout);
    }
  }
};

const buildChannelPayload = async (
  client: TelegramClient,
  origin: OriginDescriptor
): Promise<SignalIngestChannelInput> => ({
  source: config.signalsSource,
  sourceId: origin.key,
  name: origin.name,
  avatarUrl: await resolveChannelAvatarUrl(client, origin),
});

const postSignalEdit = async (payload: SignalEditInput): Promise<void> => {
  const url = new URL("/api/signals/edit", config.signalsApiUrl).toString();
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (config.signalsIngestKey) {
    headers["x-signals-key"] = config.signalsIngestKey;
  }
  const body = JSON.stringify(payload);
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });
      if (response.ok) {
        return;
      }
      const text = await response.text();
      if (response.status === 401 || response.status === 403) {
        console.error(`[messager] Edit unauthorized (${response.status}): ${text}`);
        return;
      }
      if (response.status === 404) {
        return;
      }
      if (attempt < maxAttempts) {
        console.warn(`[messager] Edit failed (${response.status}), retrying...`);
        await sleep(1000 * attempt);
        continue;
      }
      console.error(`[messager] Edit failed (${response.status}): ${text}`);
      return;
    } catch (error) {
      clearTimeout(timeout);
      if (attempt < maxAttempts) {
        console.warn("[messager] Edit error, retrying...", (error as Error).message);
        await sleep(1000 * attempt);
        continue;
      }
      console.error("[messager] Edit error:", (error as Error).message);
      return;
    } finally {
      clearTimeout(timeout);
    }
  }
};

const postSignalDelete = async (payload: SignalDeleteInput): Promise<void> => {
  const url = new URL("/api/signals/delete", config.signalsApiUrl).toString();
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (config.signalsIngestKey) {
    headers["x-signals-key"] = config.signalsIngestKey;
  }
  const body = JSON.stringify(payload);
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });
      if (response.ok) {
        return;
      }
      const text = await response.text();
      if (response.status === 401 || response.status === 403) {
        console.error(`[messager] Delete unauthorized (${response.status}): ${text}`);
        return;
      }
      if (attempt < maxAttempts) {
        console.warn(`[messager] Delete failed (${response.status}), retrying...`);
        await sleep(1000 * attempt);
        continue;
      }
      console.error(`[messager] Delete failed (${response.status}): ${text}`);
      return;
    } catch (error) {
      clearTimeout(timeout);
      if (attempt < maxAttempts) {
        console.warn("[messager] Delete error, retrying...", (error as Error).message);
        await sleep(1000 * attempt);
        continue;
      }
      console.error("[messager] Delete error:", (error as Error).message);
      return;
    } finally {
      clearTimeout(timeout);
    }
  }
};

const buildMessageSourceId = (origin: OriginDescriptor): string => `${origin.key}:${origin.messageId}`;

const ingestTelegramMessage = async (
  client: TelegramClient,
  message: Api.Message,
  peerKey: PeerKey | null
): Promise<void> => {
  if (!shouldProcessMessage(message)) {
    return;
  }
  const origin = await resolveOriginDescriptor(client, message, peerKey);
  if (!origin) {
    return;
  }
  const messageId = normalizeId((message as { id?: unknown }).id) ?? origin.messageId;
  const effectiveKey = peerKey ?? origin.key;
  const effectiveOrigin: OriginDescriptor = {
    ...origin,
    key: effectiveKey,
    name: peerNameCache.get(effectiveKey) ?? origin.name,
    messageId,
    entity: origin.key === effectiveKey ? origin.entity ?? null : null,
  };
  const payload = await buildMessagePayload(client, message);
  const sourceTimestamp = extractSourceTimestamp(message);
  const replyToMsgId = extractReplyToMessageId(message);
  const replyToSourceId = replyToMsgId ? `${effectiveOrigin.key}:${replyToMsgId}` : null;
  const sourceId = buildMessageSourceId(effectiveOrigin);
  const ingestPayload: SignalIngestInput = {
    channel: await buildChannelPayload(client, effectiveOrigin),
    message: {
      source: config.signalsSource,
      sourceId,
      type: payload.type,
      content: payload.content ?? null,
      sourceTimestamp,
      replyToSourceId,
      attachments: payload.attachments,
      link: payload.link,
    },
  };
  await postSignal(ingestPayload);
};

const fetchRecentMessages = async (
  client: TelegramClient,
  entity: GetMessagesInput,
  lookbackHours: number
): Promise<Api.Message[]> => {
  const cutoff = Math.floor(Date.now() / 1000) - lookbackHours * 3600;
  const results: Api.Message[] = [];
  let offsetId = 0;
  let done = false;
  while (!done) {
    const batch = await client.getMessages(entity as unknown as GetMessagesInput, { limit: 100, offsetId });
    if (!batch.length) {
      break;
    }
    for (const msg of batch) {
      const date = (msg as { date?: unknown }).date;
      if (typeof date === "number" && date < cutoff) {
        done = true;
        break;
      }
      results.push(msg as Api.Message);
    }
    const last = batch[batch.length - 1] as { id?: number };
    if (!last?.id || batch.length < 100) {
      break;
    }
    offsetId = last.id;
  }
  return results.reverse();
};

const handleEditedMessage = async (
  client: TelegramClient,
  message: Api.Message,
  peerKey: PeerKey | null
): Promise<void> => {
  if (!shouldProcessMessage(message)) {
    return;
  }
  const origin = await resolveOriginDescriptor(client, message, peerKey);
  if (!origin) {
    return;
  }
  const payload = await buildMessagePayload(client, message);
  const sourceId = buildMessageSourceId(origin);
  const editPayload: SignalEditInput = {
    source: config.signalsSource,
    sourceId,
    content: payload.content ?? null,
    attachments: payload.attachments,
    link: payload.link,
  };
  await postSignalEdit(editPayload);
};

const handleDeletedMessages = async (
  deletedIds: number[],
  peerKey: PeerKey | null
): Promise<void> => {
  if (!deletedIds.length) {
    return;
  }
  if (!peerKey) {
    console.warn("[messager] Cannot process deleted messages without peer context");
    return;
  }
  const sourceIds = deletedIds.map((id) => `${peerKey}:${id}`);
  const deletePayload: SignalDeleteInput = {
    source: config.signalsSource,
    sourceIds,
  };
  await postSignalDelete(deletePayload);
};

const syncRecentMessages = async (
  client: TelegramClient,
  chats: ResolvedChat[],
  lookbackHours: number
): Promise<void> => {
  if (!lookbackHours || lookbackHours <= 0 || !chats.length) {
    if (lookbackHours > 0 && !chats.length) {
      console.warn("[messager] No chats resolved for sync; skipping backfill.");
    }
    return;
  }
  console.log(`[messager] Syncing last ${lookbackHours}h of messages...`);
  for (const chat of chats) {
    try {
      const messages = await fetchRecentMessages(client, chat.entity, lookbackHours);
      for (const message of messages) {
        const messagePeerKey = buildPeerKeyFromPeer((message as { peerId?: unknown }).peerId) ?? chat.key;
        await ingestTelegramMessage(client, message, messagePeerKey);
      }
      const label = chat.name ?? chat.key;
      console.log(`[messager] Synced ${messages.length} messages from ${label}`);
    } catch (error) {
      console.warn(`[messager] Failed to sync chat ${chat.key}:`, (error as Error).message);
    }
  }
};

const run = async (): Promise<void> => {
  validateConfig();
  const server = await startMediaServer();
  const client = new TelegramClient(
    new StringSession(config.telegramSession),
    config.telegramApiId,
    config.telegramApiHash,
    {
      connectionRetries: 5,
      autoReconnect: true,
    }
  );
  const connectWithRetry = async (): Promise<void> => {
    const maxAttempts = 10;
    const baseDelayMs = 5000;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        await client.connect();
        if (!(await client.checkAuthorization())) {
          if (!config.interactiveAuth) {
            console.error("[messager] Telegram session not authorized. Set TELEGRAM_SESSION_STRING or MESSAGER_INTERACTIVE=true.");
            process.exit(1);
          }
          await authenticateUser(client);
          if (!config.telegramSession) {
            console.log("[messager] Interactive session generated. Set TELEGRAM_SESSION_STRING and restart the service.");
            try {
              await client.disconnect();
            } catch {
            }
            process.exit(0);
          }
        }
        return;
      } catch (error) {
        if (!shouldRetryAuthKeyDuplicate(error)) {
          throw error;
        }
        const delay = baseDelayMs * (attempt + 1);
        console.error(`[messager] AUTH_KEY_DUPLICATED. Retrying in ${Math.round(delay / 1000)}s...`);
        try {
          await client.disconnect();
        } catch {
        }
        await sleep(delay);
      }
    }
    throw new Error("AUTH_KEY_DUPLICATED persists after retries.");
  };
  await connectWithRetry();
  const listenChatKeys = new Set<PeerKey>();
  const resolvedChats: ResolvedChat[] = [];
  const shouldFilterChats = config.telegramListenChats.length > 0;
  if (shouldFilterChats) {
    for (const identifier of config.telegramListenChats) {
      let fallbackKey: PeerKey | null = null;
      let alternateKey: PeerKey | null = null;
      let numericId: string | null = null;
      if (/^-?\d+$/.test(identifier)) {
        if (identifier.startsWith("-100")) {
          numericId = identifier.slice(4);
          fallbackKey = `channel:${numericId}`;
        } else {
          numericId = identifier.replace("-100", "").replace("-", "");
          if (numericId) {
            fallbackKey = `chat:${numericId}`;
            alternateKey = `channel:${numericId}`;
          }
        }
      }
      try {
        const entity = await resolveChatIdentifier(client, identifier);
        const key = buildPeerKeyFromEntity(entity) ?? buildPeerKeyFromPeer(entity);
        if (key) {
          listenChatKeys.add(key);
          const name = getEntityDisplayName(entity);
          if (name) {
            peerNameCache.set(key, name);
          }
          resolvedChats.push({ key, entity: entity as unknown as GetMessagesInput, name });
          continue;
        }
        if (fallbackKey) {
          listenChatKeys.add(fallbackKey);
          if (alternateKey) {
            listenChatKeys.add(alternateKey);
          }
          resolvedChats.push({ key: fallbackKey, entity: identifier as unknown as GetMessagesInput });
          continue;
        }
      } catch (error) {
        if (fallbackKey) {
          listenChatKeys.add(fallbackKey);
          if (alternateKey) {
            listenChatKeys.add(alternateKey);
          }
          resolvedChats.push({ key: fallbackKey, entity: identifier as unknown as GetMessagesInput });
        } else {
          console.warn(`[messager] Failed to resolve chat ${identifier}:`, (error as Error).message);
        }
      }
    }
    if (!listenChatKeys.size) {
      console.warn("[messager] TELEGRAM_LISTEN_CHATS provided but no chats resolved; all chats will be ignored.");
    }
  }
  await syncRecentMessages(client, resolvedChats, config.syncLookbackHours);
  console.log("[messager] Connected. Listening for new messages...");

  client.addEventHandler(async (event) => {
    const message = (event as { message?: Api.Message }).message;
    if (!message) return;
    const peerKey = buildPeerKeyFromPeer((message as { peerId?: unknown }).peerId);
    if (shouldFilterChats && (!peerKey || !listenChatKeys.has(peerKey))) {
      return;
    }
    await ingestTelegramMessage(client, message, peerKey);
  }, new NewMessage({}));

  client.addEventHandler(async (event: EditedMessageEvent) => {
    const message = (event as { message?: Api.Message }).message;
    if (!message) return;
    const peerKey = buildPeerKeyFromPeer((message as { peerId?: unknown }).peerId);
    if (shouldFilterChats && (!peerKey || !listenChatKeys.has(peerKey))) {
      return;
    }
    await handleEditedMessage(client, message, peerKey);
  }, new EditedMessage({}));

  client.addEventHandler(async (event: DeletedMessageEvent) => {
    const deletedIds = (event as { deletedIds?: number[] }).deletedIds ?? [];
    const peer = (event as { peer?: unknown }).peer;
    const peerKey = buildPeerKeyFromPeer(peer);
    if (shouldFilterChats && peerKey && !listenChatKeys.has(peerKey)) {
      return;
    }
    await handleDeletedMessages(deletedIds, peerKey);
  }, new DeletedMessage({}));

  const shutdown = async (signal: string) => {
    console.log(`[messager] Received ${signal}, shutting down...`);
    try {
      server.close();
    } catch {
    }
    try {
      await client.disconnect();
    } catch {
    }
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
};

const shouldRetryAuthKeyDuplicate = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes("AUTH_KEY_DUPLICATED");
};

run().catch((error) => {
  console.error("[messager] Fatal error:", (error as Error).message);
  process.exit(1);
});
