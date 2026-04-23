import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError } from "@/lib/api";
import { AppError } from "@/lib/data/errors";
import { getDb } from "@/lib/db/client";
import { profilesTable } from "@/lib/db/schema";
import { isSupabaseAuthEnabled } from "@/lib/config";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/server";

const signInSchema = z.object({
  username: z.string().trim().min(2).max(18),
  password: z.string().min(8).max(120),
});

function sanitizeUsername(raw: string) {
  const normalized = raw.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 18);
  if (normalized.length < 2) {
    throw new AppError("Enter your D3T username.", 400);
  }
  return normalized;
}

function isDatabaseSetupError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return /relation .* does not exist|column .* does not exist|database.*not configured|password authentication failed|connection/i.test(
    error.message,
  );
}

export async function POST(request: Request) {
  try {
    if (!isSupabaseAuthEnabled()) {
      throw new AppError("Supabase auth is not enabled here.", 409);
    }

    const db = getDb();
    if (!db) {
      throw new AppError("Database is not configured.", 500);
    }

    const payload = signInSchema.parse(await request.json());
    const username = sanitizeUsername(payload.username);

    let profile;
    try {
      profile = await db.query.profilesTable.findFirst({
        where: eq(profilesTable.username, username),
      });
    } catch (error) {
      if (isDatabaseSetupError(error)) {
        throw new AppError("The database is not ready yet. Check DATABASE_URL and run the migrations.", 500);
      }

      throw error;
    }

    if (!profile) {
      throw new AppError("No D3T account exists for that username.", 404);
    }

    const response = NextResponse.json({ ok: true });
    const supabase = await createRouteHandlerSupabaseClient(response);
    const { error } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: payload.password,
    });

    if (error) {
      throw new AppError(error.message, 400);
    }

    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
