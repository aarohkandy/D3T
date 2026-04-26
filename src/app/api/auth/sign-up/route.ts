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
});

function sanitizeUsername(raw: string) {
  const normalized = raw.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 18);
  if (normalized.length < 2) {
    throw new AppError("Username must contain at least two letters or numbers.");
  }
  return normalized;
}

function isDatabaseSetupError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return /relation .* does not exist|column .* does not exist|database.*not configured|password authentication failed|connection|SASL|SCRAM|ENOTFOUND|getaddrinfo|ECONNREFUSED|ECONNRESET|ETIMEDOUT|timeout|no pg_hba|SSL|Tenant or user not found|PostgresError/i.test(
    error.message,
  );
}

function isExistingAccountError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return /already registered|already exists|duplicate|email.*exists|user.*exists/i.test(error.message);
}

async function signInExistingAccount(params: {
  email: string;
  password: string;
  errorMessage?: string;
}) {
  const response = NextResponse.json({ ok: true, remembered: true });
  const supabase = await createRouteHandlerSupabaseClient(response);
  const { error } = await supabase.auth.signInWithPassword({
    email: params.email,
    password: params.password,
  });

  if (error) {
    throw new AppError(params.errorMessage ?? "That account already exists. Log in with the right password.", 409);
  }

  return response;
}

export async function POST(request: Request) {
  try {
    if (!isSupabaseAuthEnabled()) {
      throw new AppError("Supabase auth is not enabled here.", 409);
    }

    const db = getDb();
    if (!db) {
      throw new AppError("D3T database is not connected yet. Add DATABASE_URL, then run npm run db:push.", 500);
    }

    const payload = signUpSchema.parse(await request.json());
    const username = sanitizeUsername(payload.username);

    let existing;
    try {
      existing = await db.query.profilesTable.findFirst({
        where: eq(profilesTable.username, username),
      });
    } catch (error) {
      if (isDatabaseSetupError(error)) {
        throw new AppError("The database is not ready yet. Check DATABASE_URL and run the migrations.", 500);
      }

      throw error;
    }

    if (existing) {
      if (existing.email.toLowerCase() === payload.email.toLowerCase()) {
        return signInExistingAccount({
          email: payload.email,
          password: payload.password,
          errorMessage: "That username already exists. Log in with the right password.",
        });
      }

      throw new AppError("That username is already taken.", 409);
    }

    const admin = createAdminSupabaseClient();
    const created = await admin.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        username,
        display_name: username,
      },
    });

    if (created.error || !created.data.user) {
      if (isExistingAccountError(created.error)) {
        return signInExistingAccount({
          email: payload.email,
          password: payload.password,
        });
      }

      throw new AppError(created.error?.message ?? "Could not create your account.", 400);
    }

    try {
      await db.insert(profilesTable).values({
        id: created.data.user.id,
        username,
        displayName: username,
        email: payload.email,
        avatarUrl: null,
        hasSeenForcedTargetHint: 0,
      });
    } catch (error) {
      await admin.auth.admin.deleteUser(created.data.user.id);
      if (isDatabaseSetupError(error)) {
        throw new AppError("The database is not ready yet. Check DATABASE_URL and run the migrations.", 500);
      }

      throw new AppError("Could not save your profile. Try again in a minute.", 500);
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
