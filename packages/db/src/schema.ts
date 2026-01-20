import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, boolean, index, integer } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  role: text("role", { enum: ["admin", "guest", "subscriber", "networker"] })
    .default("guest")
    .notNull(),
  membershipStatus: text("membership_status", {
    enum: ["active", "inactive", "deleted"],
  })
    .default("inactive")
    .notNull(),
  membershipTier: text("membership_tier", {
    enum: ["trial_weekly", "annual", "lifetime"],
  }),
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
    tier: text("tier", {
      enum: ["trial_weekly", "annual", "lifetime"],
    }).notNull(),
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
    tier: text("tier", {
      enum: ["trial_weekly", "annual", "lifetime"],
    }).notNull(),
    status: text("status", { enum: ["pending", "confirmed", "failed"] })
      .default("pending")
      .notNull(),
    amountUsdCents: integer("amount_usd_cents").notNull(),
    chain: text("chain"),
    txHash: text("tx_hash"),
    fromAddress: text("from_address"),
    toAddress: text("to_address"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    confirmedAt: timestamp("confirmed_at"),
  },
  (table) => [
    index("membership_payment_userId_idx").on(table.userId),
    index("membership_payment_status_idx").on(table.status),
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
