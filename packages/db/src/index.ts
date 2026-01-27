import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import {
  and,
  eq,
  inArray,
  isNotNull,
  isNull,
  gt,
  lte,
  lt,
  or,
  sql,
  asc,
} from "drizzle-orm";
import * as schema from "./schema";

export function createDb(connectionString: string) {
  const client = postgres(connectionString, { max: 10 });
  return drizzle(client, { schema });
}

export { schema, sql, and, eq, inArray, isNotNull, isNull, gt, lte, lt, or, asc };
