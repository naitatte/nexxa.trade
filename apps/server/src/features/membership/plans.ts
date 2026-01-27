import { db } from "../../config/db";
import { schema, eq, asc } from "@nexxatrade/db";
import { ConflictError, NotFoundError, ValidationError } from "../../types/errors";

const { membershipPlan } = schema;

type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export type MembershipPlan = {
  tier: string;
  name: string;
  description: string | null;
  priceUsdCents: number;
  durationDays: number | null;
  isActive: boolean;
  sortOrder: number;
};

type CreateMembershipPlanInput = {
  tier: string;
  name: string;
  description?: string | null;
  priceUsdCents: number;
  durationDays: number | null;
  isActive?: boolean;
  sortOrder?: number;
};

type UpdateMembershipPlanInput = {
  name?: string;
  description?: string | null;
  priceUsdCents?: number;
  durationDays?: number | null;
  isActive?: boolean;
  sortOrder?: number;
};

function mapPlanRow(row: {
  tier: string;
  name: string;
  description: string | null;
  priceUsdCents: number;
  durationDays: number | null;
  isActive: boolean;
  sortOrder: number;
}): MembershipPlan {
  return {
    tier: row.tier,
    name: row.name,
    description: row.description,
    priceUsdCents: row.priceUsdCents,
    durationDays: row.durationDays,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  };
}

function validatePlanInput(input: {
  tier?: string;
  name?: string;
  priceUsdCents?: number;
  durationDays?: number | null;
  sortOrder?: number;
}) {
  if (input.tier !== undefined && input.tier.trim().length === 0) {
    throw new ValidationError("Plan tier is required");
  }
  if (input.name !== undefined && input.name.trim().length === 0) {
    throw new ValidationError("Plan name is required");
  }
  if (input.priceUsdCents !== undefined && input.priceUsdCents <= 0) {
    throw new ValidationError("Plan price must be greater than 0");
  }
  if (input.durationDays !== undefined && input.durationDays !== null && input.durationDays <= 0) {
    throw new ValidationError("Plan duration must be greater than 0 days");
  }
  if (input.sortOrder !== undefined && input.sortOrder < 0) {
    throw new ValidationError("Plan sort order must be 0 or greater");
  }
}

export async function listMembershipPlans(input?: {
  includeInactive?: boolean;
  dbClient?: DbClient;
}): Promise<MembershipPlan[]> {
  const client: DbClient = input?.dbClient ?? db;
  const baseQuery = client
    .select({
      tier: membershipPlan.tier,
      name: membershipPlan.name,
      description: membershipPlan.description,
      priceUsdCents: membershipPlan.priceUsdCents,
      durationDays: membershipPlan.durationDays,
      isActive: membershipPlan.isActive,
      sortOrder: membershipPlan.sortOrder,
    })
    .from(membershipPlan);
  const query = input?.includeInactive
    ? baseQuery
    : baseQuery.where(eq(membershipPlan.isActive, true));
  const rows = await query.orderBy(asc(membershipPlan.sortOrder), asc(membershipPlan.name));
  return rows.map(mapPlanRow);
}

export async function getMembershipPlanByTier(
  tier: string,
  dbClient: DbClient = db
): Promise<MembershipPlan | null> {
  const rows = await dbClient
    .select({
      tier: membershipPlan.tier,
      name: membershipPlan.name,
      description: membershipPlan.description,
      priceUsdCents: membershipPlan.priceUsdCents,
      durationDays: membershipPlan.durationDays,
      isActive: membershipPlan.isActive,
      sortOrder: membershipPlan.sortOrder,
    })
    .from(membershipPlan)
    .where(eq(membershipPlan.tier, tier))
    .limit(1);
  if (!rows.length) {
    return null;
  }
  return mapPlanRow(rows[0]);
}

export async function requireMembershipPlan(
  tier: string,
  dbClient: DbClient = db
): Promise<MembershipPlan> {
  const plan = await getMembershipPlanByTier(tier, dbClient);
  if (!plan) {
    throw new NotFoundError("Membership plan", tier);
  }
  return plan;
}

export async function requireActiveMembershipPlan(
  tier: string,
  dbClient: DbClient = db
): Promise<MembershipPlan> {
  const plan = await requireMembershipPlan(tier, dbClient);
  if (!plan.isActive) {
    throw new ValidationError("Plan is not available");
  }
  return plan;
}

export async function createMembershipPlan(input: CreateMembershipPlanInput): Promise<MembershipPlan> {
  validatePlanInput(input);
  const existing = await getMembershipPlanByTier(input.tier);
  if (existing) {
    throw new ConflictError("Plan already exists");
  }
  const [row] = await db
    .insert(membershipPlan)
    .values({
      tier: input.tier,
      name: input.name,
      description: input.description ?? null,
      priceUsdCents: input.priceUsdCents,
      durationDays: input.durationDays,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning({
      tier: membershipPlan.tier,
      name: membershipPlan.name,
      description: membershipPlan.description,
      priceUsdCents: membershipPlan.priceUsdCents,
      durationDays: membershipPlan.durationDays,
      isActive: membershipPlan.isActive,
      sortOrder: membershipPlan.sortOrder,
    });
  return mapPlanRow(row);
}

export async function updateMembershipPlan(
  tier: string,
  input: UpdateMembershipPlanInput
): Promise<MembershipPlan> {
  if (!Object.keys(input).length) {
    throw new ValidationError("No plan fields provided");
  }
  validatePlanInput(input);
  const existing = await getMembershipPlanByTier(tier);
  if (!existing) {
    throw new NotFoundError("Membership plan", tier);
  }
  const [row] = await db
    .update(membershipPlan)
    .set({
      name: input.name ?? existing.name,
      description: input.description !== undefined ? input.description : existing.description,
      priceUsdCents: input.priceUsdCents ?? existing.priceUsdCents,
      durationDays: input.durationDays !== undefined ? input.durationDays : existing.durationDays,
      isActive: input.isActive ?? existing.isActive,
      sortOrder: input.sortOrder ?? existing.sortOrder,
      updatedAt: new Date(),
    })
    .where(eq(membershipPlan.tier, tier))
    .returning({
      tier: membershipPlan.tier,
      name: membershipPlan.name,
      description: membershipPlan.description,
      priceUsdCents: membershipPlan.priceUsdCents,
      durationDays: membershipPlan.durationDays,
      isActive: membershipPlan.isActive,
      sortOrder: membershipPlan.sortOrder,
    });
  return mapPlanRow(row);
}
