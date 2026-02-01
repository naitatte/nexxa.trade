import type { FastifyInstance, FastifyRequest } from "fastify";
import path from "node:path";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import type { SocketStream } from "@fastify/websocket";
import { asyncHandler } from "../../utils/async-handler";
import { env } from "../../config/env";
import { auth } from "../auth/auth";
import type { Session } from "../auth/auth";
import { ingestSignalMessage, listSignalChannels, listSignalMessages } from "./service";
import type { SignalIngestInput } from "./service";
import { broadcastSignalMessage, registerSignalSocketClient, unregisterSignalSocketClient, updateSignalSocketClient } from "./socket";

type SignalStreamQuery = {
  readonly channelId?: string;
  readonly channels?: string;
};

type SignalStreamMessage = {
  readonly type: "subscribe" | "unsubscribe";
  readonly channelId: string;
};

type SignalMessagesQuery = {
  readonly limit?: number;
  readonly before?: string;
};

type SignalMessagesParams = {
  readonly channelId: string;
};

const SIGNALS_MEDIA_ROOT = process.env.SIGNALS_MEDIA_ROOT
  ? path.resolve(process.env.SIGNALS_MEDIA_ROOT)
  : path.resolve(process.cwd(), "storage", "signals-media");
const SIGNALS_MEDIA_ROUTE = "/api/signals/media";

function getHeaderValue(value: string | string[] | undefined): string {
  if (!value) {
    return "";
  }
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value;
}

async function getSession(headers: Record<string, string | string[] | undefined>): Promise<Session | null> {
  return auth.api.getSession({ headers: headers as Record<string, string> });
}

function parseChannelIds(query: SignalStreamQuery): string[] {
  const ids: string[] = [];
  if (query.channelId) {
    ids.push(query.channelId);
  }
  if (query.channels) {
    const parts: string[] = query.channels.split(",").map((value) => value.trim()).filter((value) => value.length > 0);
    ids.push(...parts);
  }
  const unique: Set<string> = new Set(ids);
  return Array.from(unique);
}

function parseSignalStreamMessage(raw: unknown): SignalStreamMessage | null {
  const text: string = typeof raw === "string"
    ? raw
    : Buffer.isBuffer(raw)
      ? raw.toString("utf8")
      : Array.isArray(raw)
        ? Buffer.concat(raw).toString("utf8")
        : raw instanceof ArrayBuffer
          ? Buffer.from(raw).toString("utf8")
          : "";
  if (!text) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  const record = parsed as { type?: unknown; channelId?: unknown };
  if ((record.type === "subscribe" || record.type === "unsubscribe") && typeof record.channelId === "string" && record.channelId.length) {
    return { type: record.type, channelId: record.channelId };
  }
  return null;
}

async function handleSignalStream(connection: SocketStream, request: FastifyRequest): Promise<void> {
  const session: Session | null = await getSession(request.headers as Record<string, string | string[] | undefined>);
  if (!session?.user) {
    connection.socket.close(1008, "Unauthorized");
    return;
  }
  const query: SignalStreamQuery = request.query as SignalStreamQuery;
  const channelIds: string[] = parseChannelIds(query);
  const clientId: string = registerSignalSocketClient({ connection, channelIds });
  connection.socket.on("message", (raw: unknown) => {
    const message: SignalStreamMessage | null = parseSignalStreamMessage(raw);
    if (!message) {
      return;
    }
    updateSignalSocketClient({ clientId, channelId: message.channelId, action: message.type });
  });
  connection.socket.on("close", () => {
    unregisterSignalSocketClient({ clientId });
  });
}

export function registerSignalRoutes(app: FastifyInstance) {
  app.get(
    `${SIGNALS_MEDIA_ROUTE}/*`,
    asyncHandler(async (request, reply) => {
      const params = request.params as { "*": string };
      const rawPath = params["*"] ?? "";
      if (!rawPath) {
        return reply.status(404).send({ error: "Not found" });
      }
      const safePath = path.normalize(rawPath);
      if (safePath.includes("..")) {
        return reply.status(400).send({ error: "Invalid path" });
      }
      const filePath = path.join(SIGNALS_MEDIA_ROOT, safePath);
      try {
        await fs.access(filePath);
      } catch {
        return reply.status(404).send({ error: "Not found" });
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
      reply.type(contentType);
      return reply.send(createReadStream(filePath));
    })
  );
  app.get(
    "/api/signals/channels",
    {
      schema: {
        tags: ["Signals"],
        summary: "List signal channels",
        response: {
          200: {
            $ref: "SignalChannelList#",
          },
        },
      },
    },
    asyncHandler(async (request, reply) => {
      const session: Session | null = await getSession(request.headers);
      if (!session?.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      return listSignalChannels({ includeInactive: false });
    })
  );
  app.get(
    "/api/signals/channels/:channelId/messages",
    {
      schema: {
        tags: ["Signals"],
        summary: "List signal messages",
        params: {
          type: "object",
          required: ["channelId"],
          properties: {
            channelId: { type: "string" },
          },
        },
        querystring: {
          type: "object",
          properties: {
            limit: { type: "number" },
            before: { type: "string", format: "date-time" },
          },
        },
        response: {
          200: {
            $ref: "SignalMessageList#",
          },
        },
      },
    },
    asyncHandler(async (request, reply) => {
      const session: Session | null = await getSession(request.headers);
      if (!session?.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const params: SignalMessagesParams = request.params as SignalMessagesParams;
      const query: SignalMessagesQuery = request.query as SignalMessagesQuery;
      return listSignalMessages({ channelId: params.channelId, limit: query.limit, before: query.before });
    })
  );
  app.post(
    "/api/signals/ingest",
    {
      schema: {
        tags: ["Signals"],
        summary: "Ingest signal message",
        body: {
          $ref: "SignalIngestRequest#",
        },
        response: {
          200: {
            $ref: "SignalIngestResponse#",
          },
        },
      },
    },
    asyncHandler(async (request, reply) => {
      const ingestKey: string = env.SIGNALS_INGEST_KEY;
      if (ingestKey) {
        const headerKey: string = getHeaderValue(request.headers["x-signals-key"]);
        if (!headerKey || headerKey !== ingestKey) {
          return reply.status(401).send({ error: "Unauthorized" });
        }
      }
      const payload: SignalIngestInput = request.body as SignalIngestInput;
      const result = await ingestSignalMessage(payload);
      broadcastSignalMessage({ channelId: result.channel.id, message: result.message });
      return result;
    })
  );
  app.get("/api/signals/stream", { websocket: true }, handleSignalStream);
}
