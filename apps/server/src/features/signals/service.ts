import crypto from "node:crypto";
import { db } from "../../config/db";
import { schema, and, eq, inArray, lt, asc, desc } from "@nexxatrade/db";
import { NotFoundError } from "../../types/errors";

const { signalChannel, signalMessage, signalMessageAttachment, signalMessageLink } = schema;

type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

type SignalChannelRow = typeof signalChannel.$inferSelect;
type SignalMessageRow = typeof signalMessage.$inferSelect;
type SignalAttachmentRow = typeof signalMessageAttachment.$inferSelect;
type SignalLinkRow = typeof signalMessageLink.$inferSelect;

export type SignalMessageType = "text" | "image" | "audio" | "link";
export type SignalAttachmentType = "image" | "audio";

export type SignalAttachment = {
  readonly id: string;
  readonly type: SignalAttachmentType;
  readonly url: string;
  readonly mimeType: string | null;
  readonly fileName: string | null;
  readonly size: number | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly durationSeconds: number | null;
};

export type SignalLink = {
  readonly id: string;
  readonly url: string;
  readonly title: string | null;
  readonly description: string | null;
  readonly imageUrl: string | null;
  readonly siteName: string | null;
};

export type SignalMessagePreview = {
  readonly id: string;
  readonly channelId: string;
  readonly type: SignalMessageType;
  readonly content: string | null;
  readonly createdAt: string;
};

export type SignalMessage = {
  readonly id: string;
  readonly channelId: string;
  readonly type: SignalMessageType;
  readonly content: string | null;
  readonly source: string | null;
  readonly sourceId: string | null;
  readonly sourceTimestamp: string | null;
  readonly createdAt: string;
  readonly attachments: SignalAttachment[];
  readonly link?: SignalLink;
};

export type SignalChannel = {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly avatarUrl: string | null;
  readonly source: string | null;
  readonly sourceId: string | null;
  readonly isActive: boolean;
  readonly sortOrder: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly lastMessage?: SignalMessagePreview;
};

export type ListSignalChannelsInput = {
  readonly includeInactive?: boolean;
};

export type ListSignalChannelsResult = {
  readonly channels: SignalChannel[];
};

export type ListSignalMessagesInput = {
  readonly channelId: string;
  readonly limit?: number;
  readonly before?: string;
};

export type ListSignalMessagesResult = {
  readonly items: SignalMessage[];
  readonly nextCursor: string | null;
};

export type SignalIngestAttachmentInput = {
  readonly type: SignalAttachmentType;
  readonly url: string;
  readonly mimeType?: string | null;
  readonly fileName?: string | null;
  readonly size?: number | null;
  readonly width?: number | null;
  readonly height?: number | null;
  readonly durationSeconds?: number | null;
};

export type SignalIngestLinkInput = {
  readonly url: string;
  readonly title?: string | null;
  readonly description?: string | null;
  readonly imageUrl?: string | null;
  readonly siteName?: string | null;
};

export type SignalIngestMessageInput = {
  readonly source?: string | null;
  readonly sourceId?: string | null;
  readonly type: SignalMessageType;
  readonly content?: string | null;
  readonly sourceTimestamp?: string | null;
  readonly attachments?: SignalIngestAttachmentInput[];
  readonly link?: SignalIngestLinkInput;
};

export type SignalIngestChannelInput = {
  readonly source?: string | null;
  readonly sourceId?: string | null;
  readonly name?: string | null;
  readonly description?: string | null;
  readonly avatarUrl?: string | null;
  readonly isActive?: boolean | null;
  readonly sortOrder?: number | null;
};

export type SignalIngestInput = {
  readonly channelId?: string | null;
  readonly channel?: SignalIngestChannelInput;
  readonly message: SignalIngestMessageInput;
};

export type SignalIngestResult = {
  readonly channel: SignalChannel;
  readonly message: SignalMessage;
};

const toIso = (value: Date | null): string | null => (value ? value.toISOString() : null);

const mapAttachmentRow = (row: SignalAttachmentRow): SignalAttachment => ({
  id: row.id,
  type: row.type as SignalAttachmentType,
  url: row.url,
  mimeType: row.mimeType ?? null,
  fileName: row.fileName ?? null,
  size: row.size ?? null,
  width: row.width ?? null,
  height: row.height ?? null,
  durationSeconds: row.durationSeconds ?? null,
});

const mapLinkRow = (row: SignalLinkRow): SignalLink => ({
  id: row.id,
  url: row.url,
  title: row.title ?? null,
  description: row.description ?? null,
  imageUrl: row.imageUrl ?? null,
  siteName: row.siteName ?? null,
});

const mapMessagePreviewRow = (row: SignalMessageRow): SignalMessagePreview => ({
  id: row.id,
  channelId: row.channelId,
  type: row.type as SignalMessageType,
  content: row.content ?? null,
  createdAt: row.createdAt.toISOString(),
});

const mapMessageRow = (
  row: SignalMessageRow,
  attachments: SignalAttachment[],
  link?: SignalLink
): SignalMessage => ({
  id: row.id,
  channelId: row.channelId,
  type: row.type as SignalMessageType,
  content: row.content ?? null,
  source: row.source ?? null,
  sourceId: row.sourceId ?? null,
  sourceTimestamp: toIso(row.sourceTimestamp),
  createdAt: row.createdAt.toISOString(),
  attachments,
  link,
});

const mapChannelRow = (
  row: SignalChannelRow,
  lastMessage: SignalMessagePreview | null
): SignalChannel => ({
  id: row.id,
  name: row.name,
  description: row.description ?? null,
  avatarUrl: row.avatarUrl ?? null,
  source: row.source ?? null,
  sourceId: row.sourceId ?? null,
  isActive: row.isActive,
  sortOrder: row.sortOrder,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  lastMessage: lastMessage ?? undefined,
});

type RequireSignalChannelInput = {
  readonly channelId: string;
  readonly dbClient?: DbClient;
};

async function requireSignalChannel(input: RequireSignalChannelInput): Promise<SignalChannelRow> {
  const client: DbClient = input.dbClient ?? db;
  const rows: SignalChannelRow[] = await client
    .select()
    .from(signalChannel)
    .where(eq(signalChannel.id, input.channelId))
    .limit(1);
  if (!rows.length) {
    throw new NotFoundError("Signal channel", input.channelId);
  }
  return rows[0];
}

type GetSignalMessageByIdInput = {
  readonly messageId: string;
  readonly dbClient?: DbClient;
};

async function getSignalMessageById(input: GetSignalMessageByIdInput): Promise<SignalMessage | null> {
  const client: DbClient = input.dbClient ?? db;
  const messageRows: SignalMessageRow[] = await client
    .select()
    .from(signalMessage)
    .where(eq(signalMessage.id, input.messageId))
    .limit(1);
  if (!messageRows.length) {
    return null;
  }
  const attachmentRows: SignalAttachmentRow[] = await client
    .select()
    .from(signalMessageAttachment)
    .where(eq(signalMessageAttachment.messageId, input.messageId))
    .orderBy(asc(signalMessageAttachment.createdAt));
  const linkRows: SignalLinkRow[] = await client
    .select()
    .from(signalMessageLink)
    .where(eq(signalMessageLink.messageId, input.messageId))
    .orderBy(asc(signalMessageLink.createdAt));
  const attachments: SignalAttachment[] = attachmentRows.map(mapAttachmentRow);
  const link: SignalLink | undefined = linkRows.length ? mapLinkRow(linkRows[0]) : undefined;
  return mapMessageRow(messageRows[0], attachments, link);
}

type UpdateSignalChannelInput = {
  readonly dbClient: DbClient;
  readonly row: SignalChannelRow;
  readonly patch: SignalIngestChannelInput;
  readonly fallbackSource: string | null;
  readonly fallbackSourceId: string | null;
};

async function updateSignalChannel(input: UpdateSignalChannelInput): Promise<SignalChannelRow> {
  const patchName: string | null | undefined = input.patch.name;
  const nextName: string = patchName && patchName.trim().length ? patchName : input.row.name;
  const nextDescription: string | null = input.patch.description !== undefined ? input.patch.description : input.row.description;
  const nextAvatarUrl: string | null = input.patch.avatarUrl !== undefined ? input.patch.avatarUrl : input.row.avatarUrl;
  const nextIsActive: boolean = input.patch.isActive !== undefined && input.patch.isActive !== null ? input.patch.isActive : input.row.isActive;
  const nextSortOrder: number = input.patch.sortOrder !== undefined && input.patch.sortOrder !== null ? input.patch.sortOrder : input.row.sortOrder;
  const nextSource: string | null = input.patch.source !== undefined && input.patch.source !== null ? input.patch.source : input.row.source ?? input.fallbackSource ?? null;
  const nextSourceId: string | null = input.patch.sourceId !== undefined && input.patch.sourceId !== null ? input.patch.sourceId : input.row.sourceId ?? input.fallbackSourceId ?? null;
  const needsUpdate: boolean =
    nextName !== input.row.name ||
    nextDescription !== input.row.description ||
    nextAvatarUrl !== input.row.avatarUrl ||
    nextIsActive !== input.row.isActive ||
    nextSortOrder !== input.row.sortOrder ||
    nextSource !== input.row.source ||
    nextSourceId !== input.row.sourceId;
  if (!needsUpdate) {
    return input.row;
  }
  const [updated] = await input.dbClient
    .update(signalChannel)
    .set({
      name: nextName,
      description: nextDescription,
      avatarUrl: nextAvatarUrl,
      isActive: nextIsActive,
      sortOrder: nextSortOrder,
      source: nextSource,
      sourceId: nextSourceId,
      updatedAt: new Date(),
    })
    .where(eq(signalChannel.id, input.row.id))
    .returning();
  return updated ?? input.row;
}

type ResolveSignalChannelInput = {
  readonly dbClient: DbClient;
  readonly channelId: string | null | undefined;
  readonly channel: SignalIngestChannelInput | null | undefined;
  readonly messageSource: string | null;
};

async function resolveSignalChannel(input: ResolveSignalChannelInput): Promise<SignalChannelRow> {
  const channelPatch: SignalIngestChannelInput = input.channel ?? {};
  if (input.channelId) {
    const row: SignalChannelRow = await requireSignalChannel({ channelId: input.channelId, dbClient: input.dbClient });
    return updateSignalChannel({ dbClient: input.dbClient, row, patch: channelPatch, fallbackSource: input.messageSource, fallbackSourceId: channelPatch.sourceId ?? null });
  }
  const source: string | null = channelPatch.source ?? input.messageSource ?? null;
  const sourceId: string | null = channelPatch.sourceId ?? null;
  if (source && sourceId) {
    const rows: SignalChannelRow[] = await input.dbClient
      .select()
      .from(signalChannel)
      .where(and(eq(signalChannel.source, source), eq(signalChannel.sourceId, sourceId)))
      .limit(1);
    if (rows.length) {
      return updateSignalChannel({ dbClient: input.dbClient, row: rows[0], patch: channelPatch, fallbackSource: source, fallbackSourceId: sourceId });
    }
  }
  const nameCandidate: string | null | undefined = channelPatch.name;
  const name: string = nameCandidate && nameCandidate.trim().length ? nameCandidate : sourceId ?? "Signals";
  const [created] = await input.dbClient
    .insert(signalChannel)
    .values({
      id: crypto.randomUUID(),
      name,
      description: channelPatch.description ?? null,
      avatarUrl: channelPatch.avatarUrl ?? null,
      source,
      sourceId,
      isActive: channelPatch.isActive ?? true,
      sortOrder: channelPatch.sortOrder ?? 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();
  return created;
}

export async function listSignalChannels(input: ListSignalChannelsInput): Promise<ListSignalChannelsResult> {
  const includeInactive: boolean = input.includeInactive ?? false;
  const channelRows: SignalChannelRow[] = await (includeInactive
    ? db.select().from(signalChannel)
    : db.select().from(signalChannel).where(eq(signalChannel.isActive, true)))
    .orderBy(asc(signalChannel.sortOrder), asc(signalChannel.name));
  const channelIds: string[] = channelRows.map((row) => row.id);
  if (!channelIds.length) {
    return { channels: [] };
  }
  const messageRows: SignalMessageRow[] = await db
    .select()
    .from(signalMessage)
    .where(inArray(signalMessage.channelId, channelIds))
    .orderBy(asc(signalMessage.createdAt));
  const lastMessageByChannel: Map<string, SignalMessagePreview> = new Map();
  for (const row of messageRows) {
    lastMessageByChannel.set(row.channelId, mapMessagePreviewRow(row));
  }
  const channels: SignalChannel[] = channelRows.map((row) => mapChannelRow(row, lastMessageByChannel.get(row.id) ?? null));
  return { channels };
}

export async function listSignalMessages(input: ListSignalMessagesInput): Promise<ListSignalMessagesResult> {
  await requireSignalChannel({ channelId: input.channelId });
  const limit: number = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const beforeDate: Date | null = input.before ? new Date(input.before) : null;
  const safeBeforeDate: Date | null = beforeDate && Number.isNaN(beforeDate.getTime()) ? null : beforeDate;
  const filter = safeBeforeDate
    ? and(eq(signalMessage.channelId, input.channelId), lt(signalMessage.createdAt, safeBeforeDate))
    : eq(signalMessage.channelId, input.channelId);
  const messageRows: SignalMessageRow[] = await db
    .select()
    .from(signalMessage)
    .where(filter)
    .orderBy(desc(signalMessage.createdAt))
    .limit(limit + 1);
  const hasMore: boolean = messageRows.length > limit;
  const slicedRows: SignalMessageRow[] = hasMore ? messageRows.slice(0, limit) : messageRows;
  const messageIds: string[] = slicedRows.map((row) => row.id);
  if (!messageIds.length) {
    return { items: [], nextCursor: null };
  }
  const attachmentRows: SignalAttachmentRow[] = await db
    .select()
    .from(signalMessageAttachment)
    .where(inArray(signalMessageAttachment.messageId, messageIds))
    .orderBy(asc(signalMessageAttachment.createdAt));
  const linkRows: SignalLinkRow[] = await db
    .select()
    .from(signalMessageLink)
    .where(inArray(signalMessageLink.messageId, messageIds))
    .orderBy(asc(signalMessageLink.createdAt));
  const attachmentsByMessage: Map<string, SignalAttachment[]> = new Map();
  for (const row of attachmentRows) {
    const existing: SignalAttachment[] = attachmentsByMessage.get(row.messageId) ?? [];
    existing.push(mapAttachmentRow(row));
    attachmentsByMessage.set(row.messageId, existing);
  }
  const linkByMessage: Map<string, SignalLink> = new Map();
  for (const row of linkRows) {
    linkByMessage.set(row.messageId, mapLinkRow(row));
  }
  const items: SignalMessage[] = slicedRows
    .map((row) => mapMessageRow(row, attachmentsByMessage.get(row.id) ?? [], linkByMessage.get(row.id)))
    .reverse();
  const lastRow: SignalMessageRow | undefined = slicedRows[slicedRows.length - 1];
  const nextCursor: string | null = hasMore && lastRow ? lastRow.createdAt.toISOString() : null;
  return { items, nextCursor };
}

export async function ingestSignalMessage(input: SignalIngestInput): Promise<SignalIngestResult> {
  return db.transaction(async (tx: DbClient): Promise<SignalIngestResult> => {
    const messageSource: string | null = input.message.source ?? null;
    const channelRow: SignalChannelRow = await resolveSignalChannel({ dbClient: tx, channelId: input.channelId, channel: input.channel, messageSource });
    const source: string | null = input.message.source ?? channelRow.source ?? null;
    const sourceId: string | null = input.message.sourceId ?? null;
    if (source && sourceId) {
      const existingRows: SignalMessageRow[] = await tx
        .select()
        .from(signalMessage)
        .where(and(eq(signalMessage.source, source), eq(signalMessage.sourceId, sourceId)))
        .limit(1);
      if (existingRows.length) {
        const existingMessage: SignalMessage | null = await getSignalMessageById({ messageId: existingRows[0].id, dbClient: tx });
        if (!existingMessage) {
          throw new NotFoundError("Signal message", existingRows[0].id);
        }
        const preview: SignalMessagePreview = mapMessagePreviewRow(existingRows[0]);
        return { channel: mapChannelRow(channelRow, preview), message: existingMessage };
      }
    }
    const sourceTimestamp: Date | null = input.message.sourceTimestamp ? new Date(input.message.sourceTimestamp) : null;
    const safeSourceTimestamp: Date | null = sourceTimestamp && Number.isNaN(sourceTimestamp.getTime()) ? null : sourceTimestamp;
    const createdAt: Date = safeSourceTimestamp ?? new Date();
    const messageId: string = crypto.randomUUID();
    await tx.insert(signalMessage).values({
      id: messageId,
      channelId: channelRow.id,
      type: input.message.type,
      content: input.message.content ?? null,
      source,
      sourceId,
      sourceTimestamp: safeSourceTimestamp,
      createdAt,
    });
    const attachmentsInput: SignalIngestAttachmentInput[] = input.message.attachments ?? [];
    const attachments: SignalAttachment[] = [];
    if (attachmentsInput.length) {
      const attachmentValues: Array<typeof signalMessageAttachment.$inferInsert> = attachmentsInput.map((attachment) => {
        const attachmentId: string = crypto.randomUUID();
        attachments.push({
          id: attachmentId,
          type: attachment.type,
          url: attachment.url,
          mimeType: attachment.mimeType ?? null,
          fileName: attachment.fileName ?? null,
          size: attachment.size ?? null,
          width: attachment.width ?? null,
          height: attachment.height ?? null,
          durationSeconds: attachment.durationSeconds ?? null,
        });
        return {
          id: attachmentId,
          messageId,
          type: attachment.type,
          url: attachment.url,
          mimeType: attachment.mimeType ?? null,
          fileName: attachment.fileName ?? null,
          size: attachment.size ?? null,
          width: attachment.width ?? null,
          height: attachment.height ?? null,
          durationSeconds: attachment.durationSeconds ?? null,
          createdAt: new Date(),
        };
      });
      await tx.insert(signalMessageAttachment).values(attachmentValues);
    }
    let link: SignalLink | undefined = undefined;
    if (input.message.link) {
      const linkId: string = crypto.randomUUID();
      link = {
        id: linkId,
        url: input.message.link.url,
        title: input.message.link.title ?? null,
        description: input.message.link.description ?? null,
        imageUrl: input.message.link.imageUrl ?? null,
        siteName: input.message.link.siteName ?? null,
      };
      await tx.insert(signalMessageLink).values({
        id: linkId,
        messageId,
        url: link.url,
        title: link.title,
        description: link.description,
        imageUrl: link.imageUrl,
        siteName: link.siteName,
        createdAt: new Date(),
      });
    }
    const message: SignalMessage = {
      id: messageId,
      channelId: channelRow.id,
      type: input.message.type,
      content: input.message.content ?? null,
      source,
      sourceId,
      sourceTimestamp: toIso(safeSourceTimestamp),
      createdAt: createdAt.toISOString(),
      attachments,
      link,
    };
    const preview: SignalMessagePreview = {
      id: messageId,
      channelId: channelRow.id,
      type: input.message.type,
      content: input.message.content ?? null,
      createdAt: createdAt.toISOString(),
    };
    return { channel: mapChannelRow(channelRow, preview), message };
  });
}
