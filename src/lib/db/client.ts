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

  const sqlClient = getSqlClient();
  if (!sqlClient) {
    return null;
  }

  if (!global.__d3tDb) {
    global.__d3tDb = drizzle(sqlClient, { schema });
  }

  return global.__d3tDb;
}

function getSqlClient() {
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

  return global.__d3tSql;
}

function serializeDbError(error: unknown) {
  if (!(error instanceof Error)) {
    return {
      name: "UnknownError",
      message: String(error),
      code: null,
    };
  }

  const details = error as Error & {
    code?: unknown;
    errno?: unknown;
    severity?: unknown;
    hint?: unknown;
  };

  return {
    name: error.name,
    message: error.message,
    code: typeof details.code === "string" ? details.code : null,
    errno: typeof details.errno === "string" || typeof details.errno === "number" ? details.errno : null,
    severity: typeof details.severity === "string" ? details.severity : null,
    hint: typeof details.hint === "string" ? details.hint : null,
  };
}

export async function runDbDiagnostic() {
  const urlDiagnostic = process.env.DATABASE_URL
    ? getDatabaseUrlDiagnostic(
        process.env.DATABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_POOLER_HOST,
      )
    : null;

  const sql = getSqlClient();
  if (!sql) {
    return {
      ok: false,
      stage: "config",
      error: {
        name: "DatabaseDisabled",
        message: "Postgres mode is disabled or DATABASE_URL is missing.",
        code: null,
      },
      urlDiagnostic,
    };
  }

  const startedAt = Date.now();

  try {
    const ping = await sql<{
      database_name: string;
      current_user: string;
      server_version: string;
    }[]>`
      select
        current_database() as database_name,
        current_user,
        version() as server_version
    `;

    const tables = await sql<{ table_name: string }[]>`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
      order by table_name
    `;

    const columns = await sql<{ table_name: string; column_name: string }[]>`
      select table_name, column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name in ('profiles', 'games', 'moves', 'challenges')
      order by table_name, ordinal_position
    `;

    return {
      ok: true,
      stage: "query",
      latencyMs: Date.now() - startedAt,
      urlDiagnostic,
      connection: ping[0] ?? null,
      tables: tables.map((row) => row.table_name),
      columns,
    };
  } catch (error) {
    return {
      ok: false,
      stage: "query",
      latencyMs: Date.now() - startedAt,
      urlDiagnostic,
      error: serializeDbError(error),
    };
  }
}
