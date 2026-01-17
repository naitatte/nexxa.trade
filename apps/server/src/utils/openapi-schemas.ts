import type { OpenAPIV3 } from "openapi-types";

const userRoleEnum = ["admin", "guest", "subscriber", "networker"] as const;
const membershipTierEnum = ["trial_weekly", "annual", "lifetime"] as const;
const membershipStatusEnum = ["active", "inactive", "deleted"] as const;
const membershipPaymentStatusEnum = ["pending", "confirmed", "failed"] as const;

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
    enum: [...membershipTierEnum],
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
    required: ["tier", "priceUsdCents"],
    properties: {
      tier: { $ref: "MembershipTier#" },
      priceUsdCents: { type: "number" },
      durationDays: { type: "number", nullable: true },
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
      activatedAt: nullableDateTimeSchema,
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
    name: "System",
    description: "Health checks and internal metadata endpoints",
  },
];
