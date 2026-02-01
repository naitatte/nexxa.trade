import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import http from "node:http";
import dotenv from "dotenv";
import input from "input";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { NewMessage } from "telegram/events/index.js";
import { Api } from "telegram/tl/index.js";

dotenv.config();

type SignalIngestAttachmentInput = {
  readonly type: "image" | "audio";
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
  readonly type: "text" | "image" | "audio" | "link";
  readonly content?: string | null;
  readonly sourceTimestamp?: string | null;
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
type ResolvedEntity = Awaited<ReturnType<TelegramClient["getEntity"]>>;

type OriginDescriptor = {
  readonly key: PeerKey;
  readonly name: string;
  readonly fallbackName?: string | null;
  readonly messageId: string;
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
    try {
      return await client.getEntity(identifier as unknown as GetEntityInput);
    } catch (error) {
      try {
        const dialogs = await client.getDialogs();
        const found = dialogs.find((dialog) => {
          const entity = dialog.entity as { id?: unknown };
          const entityId = normalizeId(entity?.id);
          if (!entityId) return false;
          if (identifier.startsWith("-100")) {
            return entityId === identifier.slice(4) || `-100${entityId}` === identifier;
          }
          return entityId === identifier || `-100${entityId}` === identifier || entityId === identifier.replace("-100", "");
        });
        if (found) {
          return found.entity;
        }
      } catch {
      }
      const fallback = identifier.startsWith("-100") ? identifier.slice(4) : identifier;
      if (fallback !== identifier) {
        return await client.getEntity(fallback as unknown as GetEntityInput);
      }
      throw error;
    }
  }
  const cleaned = identifier.startsWith("@") ? identifier.slice(1) : identifier;
  return client.getEntity(cleaned as unknown as GetEntityInput);
};

const deriveForwardedMessageId = (message: Api.Message): string => {
  const forward = (message as { fwdFrom?: Api.MessageFwdHeader }).fwdFrom;
  const forwardRecord = forward as { channelPost?: unknown; savedFromMsgId?: unknown } | undefined;
  const channelPost = normalizeId(forwardRecord?.channelPost);
  if (channelPost) return channelPost;
  const savedFromMsgId = normalizeId(forwardRecord?.savedFromMsgId);
  if (savedFromMsgId) return savedFromMsgId;
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
    };
  }
  let resolvedName: string | null = null;
  let resolvedKey: PeerKey = originKey;
  const resolveEntity = async (entityInput: GetEntityInput) => {
    try {
      const entity = await client.getEntity(entityInput);
      resolvedName = getEntityDisplayName(entity) ?? resolvedName;
      const keyFromEntity = buildPeerKeyFromEntity(entity);
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
  return null;
};

const downloadMediaAttachment = async (
  client: TelegramClient,
  message: Api.Message,
  type: "image" | "audio",
  fileName: string | null,
  mimeType: string | null,
  durationSeconds: number | null
): Promise<SignalIngestAttachmentInput | null> => {
  if (!config.mediaPublicUrl) {
    console.warn("[messager] Media found but MESSAGER_PUBLIC_URL is empty. Skipping attachment.");
    return null;
  }
  const media = (message as { media?: unknown }).media;
  if (!media) {
    return null;
  }
  const buffer = await client.downloadMedia(media as Api.TypeMessageMedia, {});
  if (!buffer || !Buffer.isBuffer(buffer)) {
    return null;
  }
  const ext = path.extname(fileName ?? "");
  const fallbackExt = ext || getExtensionFromMime(mimeType) || (type === "image" ? ".jpg" : ".ogg");
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
  return {
    type,
    url,
    mimeType: mimeType ?? null,
    fileName: safeFileName,
    size: buffer.length,
    width: null,
    height: null,
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
  return {
    mimeType,
    fileName: typeof filenameAttr?.fileName === "string" ? filenameAttr.fileName : null,
    durationSeconds: typeof audioAttr?.duration === "number" ? audioAttr.duration : null,
    isVoice: Boolean(audioAttr?.voice),
    width: typeof imageAttr?.w === "number" ? imageAttr.w : null,
    height: typeof imageAttr?.h === "number" ? imageAttr.h : null,
  };
};

const buildMessagePayload = async (
  client: TelegramClient,
  message: Api.Message
): Promise<{
  readonly type: "text" | "image" | "audio" | "link";
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
    const attachment = await downloadMediaAttachment(client, message, "image", "photo.jpg", "image/jpeg", null);
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
    if (isImage) {
      const attachment = await downloadMediaAttachment(client, message, "image", info.fileName, info.mimeType, null);
      if (attachment) {
        return { type: "image", content: text, attachments: [attachment] };
      }
    }
    if (isAudio) {
      const attachment = await downloadMediaAttachment(client, message, "audio", info.fileName, info.mimeType, info.durationSeconds);
      if (attachment) {
        return { type: "audio", content: text, attachments: [attachment] };
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
  origin: OriginDescriptor
): Promise<SignalIngestChannelInput> => ({
  source: config.signalsSource,
  sourceId: origin.key,
  name: origin.name,
});

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
  const payload = await buildMessagePayload(client, message);
  const sourceTimestamp = extractSourceTimestamp(message);
  const ingestPayload: SignalIngestInput = {
    channel: await buildChannelPayload(origin),
    message: {
      source: config.signalsSource,
      sourceId: buildMessageSourceId(origin),
      type: payload.type,
      content: payload.content ?? null,
      sourceTimestamp,
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
        await ingestTelegramMessage(client, message, chat.key);
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
  await client.connect();
  if (!(await client.checkAuthorization())) {
    if (!config.interactiveAuth) {
      console.error("[messager] Telegram session not authorized. Set TELEGRAM_SESSION_STRING or MESSAGER_INTERACTIVE=true.");
      process.exit(1);
    }
    await authenticateUser(client);
  }
  const listenChatKeys = new Set<PeerKey>();
  const resolvedChats: ResolvedChat[] = [];
  const shouldFilterChats = config.telegramListenChats.length > 0;
  if (shouldFilterChats) {
    for (const identifier of config.telegramListenChats) {
      let fallbackKey: PeerKey | null = null;
      if (/^-?\d+$/.test(identifier)) {
        if (identifier.startsWith("-100")) {
          fallbackKey = `channel:${identifier.slice(4)}`;
        } else {
          const numeric = identifier.replace("-", "");
          fallbackKey = `chat:${numeric}`;
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
          resolvedChats.push({ key: fallbackKey, entity: identifier as unknown as GetMessagesInput });
          continue;
        }
      } catch (error) {
        if (fallbackKey) {
          listenChatKeys.add(fallbackKey);
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

run().catch((error) => {
  console.error("[messager] Fatal error:", (error as Error).message);
  process.exit(1);
});
