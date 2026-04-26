import "server-only";

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

import { isPostgresEnabled } from "@/lib/config";
import * as schema from "@/lib/db/schema";
import { getDatabaseUrlDiagnostic, normalizeDatabaseUrl } from "@/lib/db/url";

declare global {
  var __d3tSql: postgres.Sql | undefined;
  var __d3tDb:
    | ReturnType<typeof drizzle<typeof schema>>
    | undefined;
}

export function getDb() {
  if (!isPostgresEnabled() || !process.env.DATABASE_URL) {
    return null;
  }

  if (!global.__d3tSql) {
    const databaseUrl = normalizeDatabaseUrl(
      process.env.DATABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_POOLER_HOST,
    );

    if (process.env.D3T_DB_DEBUG === "true") {
      console.info(
        "[d3t db] initializing postgres client",
        getDatabaseUrlDiagnostic(process.env.DATABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_POOLER_HOST),
      );
    }

    global.__d3tSql = postgres(databaseUrl, {
      max: 1,
      prepare: false,
    });
  }

  if (!global.__d3tDb) {
    global.__d3tDb = drizzle(global.__d3tSql, { schema });
  }

  return global.__d3tDb;
}
