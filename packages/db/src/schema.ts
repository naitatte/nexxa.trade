import { relations, sql } from "drizzle-orm";
import { pgTable, text, timestamp, boolean, index, integer, pgSequence, uniqueIndex } from "drizzle-orm/pg-core";

export const paymentDerivationIndexSeq = pgSequence("payment_derivation_index_seq", {
  startWith: 1,
  increment: 1,
});

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  username: text("username").unique(),
  displayUsername: text("display_username"),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  banned: boolean("banned").default(false).notNull(),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  role: text("role", { enum: ["admin", "guest", "subscriber", "networker"] })
    .default("guest")
    .notNull(),
  membershipStatus: text("membership_status", {
    enum: ["active", "inactive", "deleted"],
  })
    .default("inactive")
    .notNull(),
  membershipTier: text("membership_tier"),
  membershipExpiresAt: timestamp("membership_expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const membership = pgTable(
  "membership",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    tier: text("tier").notNull(),
    status: text("status", { enum: ["active", "inactive", "deleted"] })
      .default("inactive")
      .notNull(),
    startsAt: timestamp("starts_at").defaultNow().notNull(),
    activatedAt: timestamp("activated_at"),
    expiresAt: timestamp("expires_at"),
    inactiveAt: timestamp("inactive_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("membership_status_idx").on(table.status),
    index("membership_expires_at_idx").on(table.expiresAt),
  ],
);

export const membershipEvent = pgTable(
  "membership_event",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    fromStatus: text("from_status", {
      enum: ["active", "inactive", "deleted"],
    }),
    toStatus: text("to_status", { enum: ["active", "inactive", "deleted"] })
      .notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("membership_event_userId_idx").on(table.userId)],
);

export const membershipPayment = pgTable(
  "membership_payment",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tier: text("tier").notNull(),
    status: text("status", { enum: ["pending", "confirmed", "failed"] })
      .default("pending")
      .notNull(),
    amountUsdCents: integer("amount_usd_cents").notNull(),
    chain: text("chain"),
    txHash: text("tx_hash"),
    fromAddress: text("from_address"),
    toAddress: text("to_address"),
    depositAddress: text("deposit_address").unique(),
    derivationIndex: integer("derivation_index")
      .unique()
      .default(sql`nextval('payment_derivation_index_seq')`),
    sweepStatus: text("sweep_status", {
      enum: ["pending", "funding", "sweeping", "swept", "failed", "exhausted"],
    }).default("pending"),
    sweepTxHash: text("sweep_tx_hash"),
    fundingTxHash: text("funding_tx_hash"),
    sweepAttemptedAt: timestamp("sweep_attempted_at"),
    sweepRetryCount: integer("sweep_retry_count").default(0),
    sweepRetryAfter: timestamp("sweep_retry_after"),
    sweepLastError: text("sweep_last_error"),
    fundedAt: timestamp("funded_at"),
    sweptAt: timestamp("swept_at"),
    appliedAt: timestamp("applied_at"),
    receivedUnits: text("received_units"),
    expectedUnits: text("expected_units"),
    overpaymentUnits: text("overpayment_units"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    confirmedAt: timestamp("confirmed_at"),
  },
  (table) => [
    index("membership_payment_userId_idx").on(table.userId),
    index("membership_payment_status_idx").on(table.status),
    index("membership_payment_depositAddress_idx").on(table.depositAddress),
    index("membership_payment_sweepStatus_idx").on(table.sweepStatus),
  ],
);

export const paymentChainCursor = pgTable("payment_chain_cursor", {
  chain: text("chain").primaryKey(),
  contract: text("contract").notNull(),
  lastScannedBlock: integer("last_scanned_block").notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const membershipPlan = pgTable(
  "membership_plan",
  {
    tier: text("tier").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    priceUsdCents: integer("price_usd_cents").notNull(),
    durationDays: integer("duration_days"),
    isActive: boolean("is_active").default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("membership_plan_active_idx").on(table.isActive),
    index("membership_plan_sort_idx").on(table.sortOrder),
  ],
);

export const commission = pgTable(
  "commission",
  {
    id: text("id").primaryKey(),
    paymentId: text("payment_id")
      .notNull()
      .references(() => membershipPayment.id, { onDelete: "cascade" }),
    fromUserId: text("from_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    toUserId: text("to_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    level: integer("level").notNull(),
    amountUsdCents: integer("amount_usd_cents").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("commission_toUserId_idx").on(table.toUserId),
    index("commission_paymentId_idx").on(table.paymentId),
  ],
);

export const walletAccount = pgTable(
  "wallet_account",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    currency: text("currency").default("USD").notNull(),
    availableUsdCents: integer("available_usd_cents").default(0).notNull(),
    reservedUsdCents: integer("reserved_usd_cents").default(0).notNull(),
    lifetimeEarnedUsdCents: integer("lifetime_earned_usd_cents").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("wallet_account_currency_idx").on(table.currency),
  ],
);

export const walletLedger = pgTable(
  "wallet_ledger",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type", {
      enum: ["credit", "debit", "reserve", "reserve_release"],
    }).notNull(),
    amountUsdCents: integer("amount_usd_cents").notNull(),
    currency: text("currency").default("USD").notNull(),
    referenceType: text("reference_type"),
    referenceId: text("reference_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("wallet_ledger_user_id_idx").on(table.userId),
    index("wallet_ledger_created_at_idx").on(table.createdAt),
  ],
);

export const walletDestination = pgTable(
  "wallet_destination",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    address: text("address").notNull(),
    chain: text("chain"),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("wallet_destination_user_id_idx").on(table.userId),
    index("wallet_destination_default_idx").on(table.userId, table.isDefault),
  ],
);

export const withdrawalRequest = pgTable(
  "withdrawal_request",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    amountUsdCents: integer("amount_usd_cents").notNull(),
    currency: text("currency").default("USD").notNull(),
    status: text("status", {
      enum: ["pending_admin", "approved", "processing", "paid", "rejected", "canceled", "failed"],
    })
      .default("pending_admin")
      .notNull(),
    destination: text("destination").notNull(),
    chain: text("chain"),
    txHash: text("tx_hash"),
    adminId: text("admin_id"),
    reason: text("reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    approvedAt: timestamp("approved_at"),
    processedAt: timestamp("processed_at"),
    paidAt: timestamp("paid_at"),
    rejectedAt: timestamp("rejected_at"),
    canceledAt: timestamp("canceled_at"),
    failedAt: timestamp("failed_at"),
  },
  (table) => [
    index("withdrawal_request_user_id_idx").on(table.userId),
    index("withdrawal_request_status_idx").on(table.status),
    index("withdrawal_request_created_at_idx").on(table.createdAt),
  ],
);

export const withdrawalEvent = pgTable(
  "withdrawal_event",
  {
    id: text("id").primaryKey(),
    withdrawalId: text("withdrawal_id")
      .notNull()
      .references(() => withdrawalRequest.id, { onDelete: "cascade" }),
    fromStatus: text("from_status", {
      enum: ["pending_admin", "approved", "processing", "paid", "rejected", "canceled", "failed"],
    }),
    toStatus: text("to_status", {
      enum: ["pending_admin", "approved", "processing", "paid", "rejected", "canceled", "failed"],
    }).notNull(),
    actorId: text("actor_id"),
    reason: text("reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("withdrawal_event_withdrawal_id_idx").on(table.withdrawalId),
    index("withdrawal_event_created_at_idx").on(table.createdAt),
  ],
);

export const referral = pgTable(
  "referral",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    sponsorId: text("sponsor_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("referral_sponsorId_idx").on(table.sponsorId)],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const twoFactor = pgTable(
  "two_factor",
  {
    id: text("id").primaryKey(),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("twoFactor_secret_idx").on(table.secret),
    index("twoFactor_userId_idx").on(table.userId),
  ],
);

export const signalChannel = pgTable(
  "signal_channel",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    avatarUrl: text("avatar_url"),
    source: text("source"),
    sourceId: text("source_id"),
    isActive: boolean("is_active").default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("signal_channel_source_idx").on(table.source),
    index("signal_channel_sort_idx").on(table.sortOrder),
    uniqueIndex("signal_channel_source_sourceId_idx").on(table.source, table.sourceId),
  ],
);

export const signalMessage = pgTable(
  "signal_message",
  {
    id: text("id").primaryKey(),
    channelId: text("channel_id")
      .notNull()
      .references(() => signalChannel.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["text", "image", "audio", "link", "video"] }).notNull(),
    content: text("content"),
    source: text("source"),
    sourceId: text("source_id"),
    sourceTimestamp: timestamp("source_timestamp"),
    replyToId: text("reply_to_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("signal_message_channelId_idx").on(table.channelId),
    index("signal_message_createdAt_idx").on(table.createdAt),
    uniqueIndex("signal_message_source_sourceId_idx").on(table.source, table.sourceId),
  ],
);

export const signalMessageAttachment = pgTable(
  "signal_message_attachment",
  {
    id: text("id").primaryKey(),
    messageId: text("message_id")
      .notNull()
      .references(() => signalMessage.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["image", "audio", "video"] }).notNull(),
    url: text("url").notNull(),
    mimeType: text("mime_type"),
    fileName: text("file_name"),
    size: integer("size"),
    width: integer("width"),
    height: integer("height"),
    durationSeconds: integer("duration_seconds"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("signal_message_attachment_messageId_idx").on(table.messageId)],
);

export const signalMessageLink = pgTable(
  "signal_message_link",
  {
    id: text("id").primaryKey(),
    messageId: text("message_id")
      .notNull()
      .references(() => signalMessage.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    title: text("title"),
    description: text("description"),
    imageUrl: text("image_url"),
    siteName: text("site_name"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("signal_message_link_messageId_idx").on(table.messageId)],
);

export const userRelations = relations(user, ({ many, one }) => ({
  sessions: many(session),
  accounts: many(account),
  referrals: many(referral),
  membership: one(membership, {
    fields: [user.id],
    references: [membership.userId],
  }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const membershipRelations = relations(membership, ({ one }) => ({
  user: one(user, {
    fields: [membership.userId],
    references: [user.id],
  }),
}));

export const referralRelations = relations(referral, ({ one }) => ({
  user: one(user, {
    fields: [referral.userId],
    references: [user.id],
  }),
  sponsor: one(user, {
    fields: [referral.sponsorId],
    references: [user.id],
  }),
}));
