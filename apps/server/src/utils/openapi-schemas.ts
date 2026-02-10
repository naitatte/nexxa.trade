import type { OpenAPIV3 } from "openapi-types";

const userRoleEnum = ["admin", "guest", "subscriber", "networker"] as const;
const membershipStatusEnum = ["active", "inactive", "deleted"] as const;
const membershipPaymentStatusEnum = ["pending", "confirmed", "failed"] as const;
const withdrawalStatusEnum = [
  "pending_admin",
  "approved",
  "processing",
  "paid",
  "rejected",
  "canceled",
  "failed",
] as const;
const signalMessageTypeEnum = ["text", "image", "audio", "link", "video"] as const;
const signalAttachmentTypeEnum = ["image", "audio", "video"] as const;

const dateTimeSchema: OpenAPIV3.SchemaObject = {
  type: "string",
  format: "date-time",
};

const nullableDateTimeSchema: OpenAPIV3.SchemaObject = {
  type: "string",
  format: "date-time",
  nullable: true,
};

export const openApiSchemas: Record<string, OpenAPIV3.SchemaObject> = {
  UserRole: {
    type: "string",
    enum: [...userRoleEnum],
  },
  MembershipTier: {
    type: "string",
    description: "Plan tier identifier",
  },
  MembershipStatus: {
    type: "string",
    enum: [...membershipStatusEnum],
  },
  MembershipPaymentStatus: {
    type: "string",
    enum: [...membershipPaymentStatusEnum],
  },
  User: {
    type: "object",
    required: [
      "id",
      "name",
      "email",
      "emailVerified",
      "role",
      "membershipStatus",
      "createdAt",
      "updatedAt",
    ],
    properties: {
      id: { type: "string" },
      name: { type: "string" },
      username: { type: "string", nullable: true },
      displayUsername: { type: "string", nullable: true },
      email: { type: "string", format: "email" },
      emailVerified: { type: "boolean" },
      image: { type: "string", nullable: true },
      role: { $ref: "UserRole#" },
      membershipStatus: { $ref: "MembershipStatus#" },
      membershipTier: {
        $ref: "MembershipTier#",
        nullable: true,
      },
      membershipExpiresAt: nullableDateTimeSchema,
      createdAt: dateTimeSchema,
      updatedAt: dateTimeSchema,
      membership: {
        $ref: "Membership#",
        nullable: true,
      },
      referral: {
        $ref: "Referral#",
        nullable: true,
      },
    },
  },
  Membership: {
    type: "object",
    required: [
      "userId",
      "tier",
      "status",
      "startsAt",
      "createdAt",
      "updatedAt",
    ],
    properties: {
      userId: { type: "string" },
      tier: { $ref: "MembershipTier#" },
      status: { $ref: "MembershipStatus#" },
      startsAt: dateTimeSchema,
      activatedAt: nullableDateTimeSchema,
      expiresAt: nullableDateTimeSchema,
      inactiveAt: nullableDateTimeSchema,
      createdAt: dateTimeSchema,
      updatedAt: dateTimeSchema,
    },
  },
  MembershipEvent: {
    type: "object",
    required: ["id", "userId", "toStatus", "createdAt"],
    properties: {
      id: { type: "string" },
      userId: { type: "string" },
      fromStatus: {
        $ref: "MembershipStatus#",
        nullable: true,
      },
      toStatus: { $ref: "MembershipStatus#" },
      reason: { type: "string", nullable: true },
      createdAt: dateTimeSchema,
    },
  },
  MembershipPayment: {
    type: "object",
    required: [
      "id",
      "userId",
      "tier",
      "status",
      "amountUsdCents",
      "createdAt",
    ],
    properties: {
      id: { type: "string" },
      userId: { type: "string" },
      tier: { $ref: "MembershipTier#" },
      status: { $ref: "MembershipPaymentStatus#" },
      amountUsdCents: { type: "number" },
      chain: { type: "string", nullable: true },
      txHash: { type: "string", nullable: true },
      fromAddress: { type: "string", nullable: true },
      toAddress: { type: "string", nullable: true },
      createdAt: dateTimeSchema,
      confirmedAt: nullableDateTimeSchema,
    },
  },
  Commission: {
    type: "object",
    required: [
      "id",
      "paymentId",
      "fromUserId",
      "toUserId",
      "level",
      "amountUsdCents",
      "createdAt",
    ],
    properties: {
      id: { type: "string" },
      paymentId: { type: "string" },
      fromUserId: { type: "string" },
      toUserId: { type: "string" },
      level: { type: "number" },
      amountUsdCents: { type: "number" },
      createdAt: dateTimeSchema,
    },
  },
  WalletSummary: {
    type: "object",
    required: [
      "currency",
      "availableUsdCents",
      "reservedUsdCents",
      "lifetimeEarnedUsdCents",
      "pendingUsdCents",
    ],
    properties: {
      currency: { type: "string" },
      availableUsdCents: { type: "number" },
      reservedUsdCents: { type: "number" },
      lifetimeEarnedUsdCents: { type: "number" },
      pendingUsdCents: { type: "number" },
    },
  },
  WalletDestination: {
    type: "object",
    required: ["id", "label", "address", "chain", "isDefault", "createdAt", "updatedAt"],
    properties: {
      id: { type: "string" },
      label: { type: "string" },
      address: { type: "string" },
      chain: { type: "string", nullable: true },
      isDefault: { type: "boolean" },
      createdAt: dateTimeSchema,
      updatedAt: dateTimeSchema,
    },
  },
  WalletTransaction: {
    type: "object",
    required: [
      "id",
      "type",
      "amountUsdCents",
      "status",
      "chain",
      "txHash",
      "address",
      "createdAt",
      "completedAt",
    ],
    properties: {
      id: { type: "string" },
      type: { type: "string", enum: ["deposit", "withdrawal"] },
      amountUsdCents: { type: "number" },
      status: { type: "string" },
      chain: { type: "string", nullable: true },
      txHash: { type: "string", nullable: true },
      address: { type: "string", nullable: true },
      createdAt: dateTimeSchema,
      completedAt: nullableDateTimeSchema,
    },
  },
  WithdrawalStatus: {
    type: "string",
    enum: [...withdrawalStatusEnum],
  },
  WithdrawalRequest: {
    type: "object",
    required: [
      "id",
      "userId",
      "amountUsdCents",
      "currency",
      "status",
      "destination",
      "chain",
      "txHash",
      "adminId",
      "reason",
      "createdAt",
      "approvedAt",
      "processedAt",
      "paidAt",
      "rejectedAt",
      "canceledAt",
      "failedAt",
    ],
    properties: {
      id: { type: "string" },
      userId: { type: "string" },
      amountUsdCents: { type: "number" },
      currency: { type: "string" },
      status: { $ref: "WithdrawalStatus#" },
      destination: { type: "string" },
      chain: { type: "string", nullable: true },
      txHash: { type: "string", nullable: true },
      adminId: { type: "string", nullable: true },
      reason: { type: "string", nullable: true },
      createdAt: dateTimeSchema,
      approvedAt: nullableDateTimeSchema,
      processedAt: nullableDateTimeSchema,
      paidAt: nullableDateTimeSchema,
      rejectedAt: nullableDateTimeSchema,
      canceledAt: nullableDateTimeSchema,
      failedAt: nullableDateTimeSchema,
    },
  },
  Referral: {
    type: "object",
    required: ["userId", "createdAt", "updatedAt"],
    properties: {
      userId: { type: "string" },
      sponsorId: { type: "string", nullable: true },
      createdAt: dateTimeSchema,
      updatedAt: dateTimeSchema,
    },
  },
  Session: {
    type: "object",
    required: ["id", "expiresAt", "token", "createdAt", "updatedAt", "userId"],
    properties: {
      id: { type: "string" },
      expiresAt: dateTimeSchema,
      token: { type: "string" },
      createdAt: dateTimeSchema,
      updatedAt: dateTimeSchema,
      ipAddress: { type: "string", nullable: true },
      userAgent: { type: "string", nullable: true },
      userId: { type: "string" },
    },
  },
  Account: {
    type: "object",
    required: ["id", "accountId", "providerId", "userId", "createdAt", "updatedAt"],
    properties: {
      id: { type: "string" },
      accountId: { type: "string" },
      providerId: { type: "string" },
      userId: { type: "string" },
      accessToken: { type: "string", nullable: true },
      refreshToken: { type: "string", nullable: true },
      idToken: { type: "string", nullable: true },
      accessTokenExpiresAt: nullableDateTimeSchema,
      refreshTokenExpiresAt: nullableDateTimeSchema,
      scope: { type: "string", nullable: true },
      password: { type: "string", nullable: true },
      createdAt: dateTimeSchema,
      updatedAt: dateTimeSchema,
    },
  },
  Verification: {
    type: "object",
    required: ["id", "identifier", "value", "expiresAt", "createdAt", "updatedAt"],
    properties: {
      id: { type: "string" },
      identifier: { type: "string" },
      value: { type: "string" },
      expiresAt: dateTimeSchema,
      createdAt: dateTimeSchema,
      updatedAt: dateTimeSchema,
    },
  },
  MembershipTierInfo: {
    type: "object",
    required: ["tier", "name", "priceUsdCents", "isActive", "sortOrder"],
    properties: {
      tier: { $ref: "MembershipTier#" },
      name: { type: "string" },
      description: { type: "string", nullable: true },
      priceUsdCents: { type: "number" },
      durationDays: { type: "number", nullable: true },
      isActive: { type: "boolean" },
      sortOrder: { type: "number" },
    },
  },
  MembershipTierList: {
    type: "object",
    required: ["tiers"],
    properties: {
      tiers: {
        type: "array",
        items: { $ref: "MembershipTierInfo#" },
      },
    },
  },
  MembershipState: {
    type: "object",
    required: ["userId", "status"],
    properties: {
      userId: { type: "string" },
      status: { $ref: "MembershipStatus#" },
      tier: {
        $ref: "MembershipTier#",
        nullable: true,
      },
      expiresAt: nullableDateTimeSchema,
      inactiveAt: nullableDateTimeSchema,
      deletionAt: nullableDateTimeSchema,
      activatedAt: nullableDateTimeSchema,
      deletionDays: { type: "number" },
    },
  },
  ActivateMembershipRequest: {
    type: "object",
    required: ["userId", "tier", "amountUsdCents"],
    properties: {
      userId: { type: "string" },
      tier: { $ref: "MembershipTier#" },
      amountUsdCents: { type: "number" },
      paymentId: { type: "string" },
      txHash: { type: "string" },
      chain: { type: "string" },
      fromAddress: { type: "string" },
      toAddress: { type: "string" },
      reason: { type: "string" },
    },
  },
  ActivateMembershipResponse: {
    type: "object",
    required: ["paymentId", "status", "commissionsCreated"],
    properties: {
      paymentId: { type: "string" },
      status: { $ref: "MembershipStatus#" },
      commissionsCreated: { type: "number" },
      expiresAt: nullableDateTimeSchema,
    },
  },
  ExpireMembershipsResponse: {
    type: "object",
    required: ["expiredCount"],
    properties: {
      expiredCount: { type: "number" },
    },
  },
  CompressMembershipsResponse: {
    type: "object",
    required: ["compressedCount"],
    properties: {
      compressedCount: { type: "number" },
    },
  },
  SignalMessageType: {
    type: "string",
    enum: [...signalMessageTypeEnum],
  },
  SignalAttachmentType: {
    type: "string",
    enum: [...signalAttachmentTypeEnum],
  },
  SignalAttachment: {
    type: "object",
    required: ["id", "type", "url"],
    properties: {
      id: { type: "string" },
      type: { $ref: "SignalAttachmentType#" },
      url: { type: "string" },
      mimeType: { type: "string", nullable: true },
      fileName: { type: "string", nullable: true },
      size: { type: "number", nullable: true },
      width: { type: "number", nullable: true },
      height: { type: "number", nullable: true },
      durationSeconds: { type: "number", nullable: true },
    },
  },
  SignalLink: {
    type: "object",
    required: ["id", "url"],
    properties: {
      id: { type: "string" },
      url: { type: "string" },
      title: { type: "string", nullable: true },
      description: { type: "string", nullable: true },
      imageUrl: { type: "string", nullable: true },
      siteName: { type: "string", nullable: true },
    },
  },
  SignalMessagePreview: {
    type: "object",
    required: ["id", "channelId", "type", "createdAt"],
    properties: {
      id: { type: "string" },
      channelId: { type: "string" },
      type: { $ref: "SignalMessageType#" },
      content: { type: "string", nullable: true },
      createdAt: dateTimeSchema,
    },
  },
  SignalReplyPreview: {
    type: "object",
    required: ["id", "type"],
    properties: {
      id: { type: "string" },
      type: { $ref: "SignalMessageType#" },
      content: { type: "string", nullable: true },
    },
  },
  SignalMessage: {
    type: "object",
    required: ["id", "channelId", "type", "attachments", "createdAt"],
    properties: {
      id: { type: "string" },
      channelId: { type: "string" },
      type: { $ref: "SignalMessageType#" },
      content: { type: "string", nullable: true },
      source: { type: "string", nullable: true },
      sourceId: { type: "string", nullable: true },
      sourceTimestamp: nullableDateTimeSchema,
      replyToId: { type: "string", nullable: true },
      replyTo: { $ref: "SignalReplyPreview#" },
      createdAt: dateTimeSchema,
      attachments: {
        type: "array",
        items: { $ref: "SignalAttachment#" },
      },
      link: {
        $ref: "SignalLink#",
      },
    },
  },
  SignalChannel: {
    type: "object",
    required: [
      "id",
      "name",
      "isActive",
      "sortOrder",
      "createdAt",
      "updatedAt",
    ],
    properties: {
      id: { type: "string" },
      name: { type: "string" },
      description: { type: "string", nullable: true },
      avatarUrl: { type: "string", nullable: true },
      source: { type: "string", nullable: true },
      sourceId: { type: "string", nullable: true },
      isActive: { type: "boolean" },
      sortOrder: { type: "number" },
      createdAt: dateTimeSchema,
      updatedAt: dateTimeSchema,
      lastMessage: {
        $ref: "SignalMessagePreview#",
      },
    },
  },
  SignalChannelList: {
    type: "object",
    required: ["channels"],
    properties: {
      channels: {
        type: "array",
        items: { $ref: "SignalChannel#" },
      },
    },
  },
  SignalMessageList: {
    type: "object",
    required: ["items"],
    properties: {
      items: {
        type: "array",
        items: { $ref: "SignalMessage#" },
      },
      nextCursor: { type: "string", nullable: true },
    },
  },
  SignalIngestAttachment: {
    type: "object",
    required: ["type", "url"],
    properties: {
      type: { $ref: "SignalAttachmentType#" },
      url: { type: "string" },
      mimeType: { type: "string", nullable: true },
      fileName: { type: "string", nullable: true },
      size: { type: "number", nullable: true },
      width: { type: "number", nullable: true },
      height: { type: "number", nullable: true },
      durationSeconds: { type: "number", nullable: true },
    },
  },
  SignalIngestLink: {
    type: "object",
    required: ["url"],
    properties: {
      url: { type: "string" },
      title: { type: "string", nullable: true },
      description: { type: "string", nullable: true },
      imageUrl: { type: "string", nullable: true },
      siteName: { type: "string", nullable: true },
    },
  },
  SignalIngestMessage: {
    type: "object",
    required: ["type"],
    properties: {
      source: { type: "string", nullable: true },
      sourceId: { type: "string", nullable: true },
      type: { $ref: "SignalMessageType#" },
      content: { type: "string", nullable: true },
      sourceTimestamp: nullableDateTimeSchema,
      replyToSourceId: { type: "string", nullable: true },
      attachments: {
        type: "array",
        items: { $ref: "SignalIngestAttachment#" },
      },
      link: {
        $ref: "SignalIngestLink#",
      },
    },
  },
  SignalIngestChannel: {
    type: "object",
    properties: {
      source: { type: "string", nullable: true },
      sourceId: { type: "string", nullable: true },
      name: { type: "string", nullable: true },
      description: { type: "string", nullable: true },
      avatarUrl: { type: "string", nullable: true },
      isActive: { type: "boolean", nullable: true },
      sortOrder: { type: "number", nullable: true },
    },
  },
  SignalIngestRequest: {
    type: "object",
    required: ["message"],
    properties: {
      channelId: { type: "string", nullable: true },
      channel: { $ref: "SignalIngestChannel#" },
      message: { $ref: "SignalIngestMessage#" },
    },
  },
  SignalIngestResponse: {
    type: "object",
    required: ["channel", "message"],
    properties: {
      channel: { $ref: "SignalChannel#" },
      message: { $ref: "SignalMessage#" },
    },
  },
  SignalEditRequest: {
    type: "object",
    required: ["source", "sourceId"],
    properties: {
      source: { type: "string" },
      sourceId: { type: "string" },
      content: { type: "string", nullable: true },
      attachments: {
        type: "array",
        items: { $ref: "SignalIngestAttachment#" },
      },
      link: { $ref: "SignalIngestLink#" },
    },
  },
  SignalEditResponse: {
    type: "object",
    required: ["message"],
    properties: {
      message: { $ref: "SignalMessage#" },
    },
  },
  SignalDeleteRequest: {
    type: "object",
    required: ["source", "sourceIds"],
    properties: {
      source: { type: "string" },
      sourceIds: {
        type: "array",
        items: { type: "string" },
      },
    },
  },
  SignalDeleteResponse: {
    type: "object",
    required: ["deletedCount", "deletedIds"],
    properties: {
      deletedCount: { type: "number" },
      deletedIds: {
        type: "array",
        items: { type: "string" },
      },
    },
  },
};

export const openApiTags: OpenAPIV3.TagObject[] = [
  {
    name: "Auth",
    description: "Authentication and user session management",
  },
  {
    name: "Auth / Admin",
    description: "Administrative authentication and user management",
  },
  {
    name: "Membership",
    description: "Membership tiers, activation, and lifecycle",
  },
  {
    name: "Wallet",
    description: "Wallet balances and ledger activity",
  },
  {
    name: "Withdrawals",
    description: "Withdrawal requests and approval workflow",
  },
  {
    name: "Referrals",
    description: "Referral stats and team endpoints",
  },
  {
    name: "System",
    description: "Health checks and internal metadata endpoints",
  },
  {
    name: "Signals",
    description: "Signals channels, messages, and realtime updates",
  },
];
