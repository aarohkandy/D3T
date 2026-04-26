import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError } from "@/lib/data/errors";

function getErrorText(error: Error) {
  const details = error as Error & {
    code?: unknown;
    cause?: unknown;
  };

  return [
    error.name,
    error.message,
    typeof details.code === "string" ? details.code : "",
    details.cause instanceof Error ? details.cause.message : String(details.cause ?? ""),
  ].join(" ");
}

function getSetupErrorMessage(error: Error) {
  const text = getErrorText(error);

  if (/DATABASE_URL|Postgres driver|url: ''|database is not configured|invalid.*connection.*string/i.test(text)) {
    return "D3T database is not connected yet. Add DATABASE_URL, then run npm run db:push.";
  }

  if (/relation .* does not exist|column .* does not exist|undefined_table|42703|42P01/i.test(text)) {
    return "D3T database tables are missing. Run npm run db:push, then try again.";
  }

  if (/password authentication failed|SASL|SCRAM|28P01/i.test(text)) {
    return "D3T could not connect to Supabase Postgres. Check DATABASE_URL and the database password.";
  }

  if (/ENOTFOUND|getaddrinfo|ECONNREFUSED|ECONNRESET|ETIMEDOUT|timeout|connection terminated|fetch failed|no pg_hba|SSL|Tenant or user not found|role .* does not exist|PostgresError/i.test(text)) {
    return "D3T could not query Supabase Postgres. Check DATABASE_URL, the database password, and whether migrations have run.";
  }

  if (/Supabase.*not configured|service role/i.test(text)) {
    return "D3T auth is missing Supabase environment variables. Check the Supabase URL, publishable key, service role key, and DATABASE_URL.";
  }

  return null;
}

export function handleRouteError(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof Error && error.message === "Unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: error.issues[0]?.message ?? "Invalid request payload.",
      },
      { status: 400 },
    );
  }

  if (error instanceof Error) {
    const setupMessage = getSetupErrorMessage(error);
    if (setupMessage) {
      console.error("[route setup error]", error);
      return NextResponse.json({ error: setupMessage }, { status: 500 });
    }
  }

  console.error(error);
  return NextResponse.json(
    { error: "Server setup is not finished yet. Check Supabase keys, DATABASE_URL, and database migrations." },
    { status: 500 },
  );
}
