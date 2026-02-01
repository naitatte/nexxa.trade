import crypto from "node:crypto";
import type { SocketStream } from "@fastify/websocket";
import { logger } from "../../config/logger";
import type { SignalMessage } from "./service";

type SignalSocketClient = {
  readonly id: string;
  readonly connection: SocketStream;
  readonly channels: Set<string>;
};

type RegisterSignalSocketClientInput = {
  readonly connection: SocketStream;
  readonly channelIds: string[];
};

type UnregisterSignalSocketClientInput = {
  readonly clientId: string;
};

type UpdateSignalSocketClientInput = {
  readonly clientId: string;
  readonly channelId: string;
  readonly action: "subscribe" | "unsubscribe";
};

type BroadcastSignalMessageInput = {
  readonly channelId: string;
  readonly message: SignalMessage;
};

const clients: Map<string, SignalSocketClient> = new Map();
const channelSubscriptions: Map<string, Set<string>> = new Map();

function addClientToChannel(clientId: string, channelId: string): void {
  const bucket: Set<string> = channelSubscriptions.get(channelId) ?? new Set();
  bucket.add(clientId);
  channelSubscriptions.set(channelId, bucket);
}

function removeClientFromChannel(clientId: string, channelId: string): void {
  const bucket: Set<string> | undefined = channelSubscriptions.get(channelId);
  if (!bucket) {
    return;
  }
  bucket.delete(clientId);
  if (!bucket.size) {
    channelSubscriptions.delete(channelId);
  } else {
    channelSubscriptions.set(channelId, bucket);
  }
}

export function registerSignalSocketClient(input: RegisterSignalSocketClientInput): string {
  const clientId: string = crypto.randomUUID();
  const channelSet: Set<string> = new Set();
  for (const channelId of input.channelIds) {
    if (!channelId) {
      continue;
    }
    channelSet.add(channelId);
    addClientToChannel(clientId, channelId);
  }
  const client: SignalSocketClient = { id: clientId, connection: input.connection, channels: channelSet };
  clients.set(clientId, client);
  return clientId;
}

export function unregisterSignalSocketClient(input: UnregisterSignalSocketClientInput): void {
  const client: SignalSocketClient | undefined = clients.get(input.clientId);
  if (!client) {
    return;
  }
  clients.delete(input.clientId);
  for (const channelId of client.channels) {
    removeClientFromChannel(input.clientId, channelId);
  }
}

export function updateSignalSocketClient(input: UpdateSignalSocketClientInput): void {
  const client: SignalSocketClient | undefined = clients.get(input.clientId);
  if (!client) {
    return;
  }
  if (input.action === "subscribe") {
    if (!client.channels.has(input.channelId)) {
      client.channels.add(input.channelId);
      addClientToChannel(input.clientId, input.channelId);
    }
    return;
  }
  if (client.channels.has(input.channelId)) {
    client.channels.delete(input.channelId);
    removeClientFromChannel(input.clientId, input.channelId);
  }
}

export function broadcastSignalMessage(input: BroadcastSignalMessageInput): void {
  const subscribers: Set<string> | undefined = channelSubscriptions.get(input.channelId);
  if (!subscribers || !subscribers.size) {
    return;
  }
  const payload: string = JSON.stringify({ type: "message", channelId: input.channelId, message: input.message });
  for (const clientId of subscribers) {
    const client: SignalSocketClient | undefined = clients.get(clientId);
    if (!client) {
      continue;
    }
    try {
      client.connection.socket.send(payload);
    } catch (error) {
      logger.warn("Signal socket broadcast failed", { error, clientId, channelId: input.channelId });
    }
  }
}
