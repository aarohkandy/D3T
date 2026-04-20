import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { AppError } from "@/lib/data/errors";
import { isSupabaseAuthEnabled } from "@/lib/config";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    if (!isSupabaseAuthEnabled()) {
      throw new AppError("Supabase auth is not enabled here.", 409);
    }

    const response = NextResponse.json({ ok: true });
    const supabase = await createRouteHandlerSupabaseClient(response);
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw new AppError(error.message, 400);
    }

    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
