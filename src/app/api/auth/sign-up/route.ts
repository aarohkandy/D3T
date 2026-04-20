import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError } from "@/lib/api";
import { AppError } from "@/lib/data/errors";
import { getDb } from "@/lib/db/client";
import { profilesTable } from "@/lib/db/schema";
import { isSupabaseAuthEnabled } from "@/lib/config";
import { createAdminSupabaseClient, createRouteHandlerSupabaseClient } from "@/lib/supabase/server";

const signUpSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(120),
  username: z.string().trim().min(2).max(18),
  displayName: z.string().trim().min(2).max(32),
});

function sanitizeUsername(raw: string) {
  const normalized = raw.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 18);
  if (normalized.length < 2) {
    throw new AppError("Username must contain at least two letters or numbers.");
  }
  return normalized;
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

    const payload = signUpSchema.parse(await request.json());
    const username = sanitizeUsername(payload.username);

    const existing = await db.query.profilesTable.findFirst({
      where: eq(profilesTable.username, username),
    });

    if (existing) {
      throw new AppError("That username is already taken.", 409);
    }

    const admin = createAdminSupabaseClient();
    const created = await admin.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        username,
        display_name: payload.displayName,
      },
    });

    if (created.error || !created.data.user) {
      throw new AppError(created.error?.message ?? "Could not create your account.", 400);
    }

    try {
      await db.insert(profilesTable).values({
        id: created.data.user.id,
        username,
        displayName: payload.displayName,
        email: payload.email,
        avatarUrl: null,
        hasSeenForcedTargetHint: 0,
      });
    } catch (error) {
      await admin.auth.admin.deleteUser(created.data.user.id);
      throw error;
    }

    const response = NextResponse.json({ ok: true });
    const supabase = await createRouteHandlerSupabaseClient(response);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: payload.email,
      password: payload.password,
    });

    if (signInError) {
      throw new AppError(signInError.message, 400);
    }

    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
