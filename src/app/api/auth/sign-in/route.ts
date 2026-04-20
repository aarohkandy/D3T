import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError } from "@/lib/api";
import { AppError } from "@/lib/data/errors";
import { isSupabaseAuthEnabled } from "@/lib/config";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/server";

const signInSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(120),
});

export async function POST(request: Request) {
  try {
    if (!isSupabaseAuthEnabled()) {
      throw new AppError("Supabase auth is not enabled here.", 409);
    }

    const payload = signInSchema.parse(await request.json());
    const response = NextResponse.json({ ok: true });
    const supabase = await createRouteHandlerSupabaseClient(response);
    const { error } = await supabase.auth.signInWithPassword({
      email: payload.email,
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
