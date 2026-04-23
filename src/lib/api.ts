import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError } from "@/lib/data/errors";

function getSetupErrorMessage(error: Error) {
  if (/DATABASE_URL|Postgres driver|url: ''|database is not configured/i.test(error.message)) {
    return "D3T database is not connected yet. Add DATABASE_URL, then run npm run db:push.";
  }

  if (/relation .* does not exist|column .* does not exist/i.test(error.message)) {
    return "D3T database tables are missing. Run npm run db:push, then try again.";
  }

  if (/password authentication failed|connection/i.test(error.message)) {
    return "D3T could not connect to Supabase Postgres. Check DATABASE_URL and the database password.";
  }

  if (/Supabase.*not configured|service role/i.test(error.message)) {
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
      return NextResponse.json({ error: setupMessage }, { status: 500 });
    }
  }

  console.error(error);
  return NextResponse.json(
    { error: "Server setup is not finished yet. Check Supabase keys, DATABASE_URL, and database migrations." },
    { status: 500 },
  );
}
