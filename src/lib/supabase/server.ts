import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { appConfig, isSupabaseAuthEnabled } from "@/lib/config";
import { getSupabasePublicConfig } from "@/lib/supabase/env";

function assertSupabaseEnabled() {
  if (!isSupabaseAuthEnabled()) {
    throw new Error("Supabase auth is not configured.");
  }

  return getSupabasePublicConfig();
}

export async function createServerSupabaseClient() {
  const { url, publishableKey } = assertSupabaseEnabled();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always mutate cookies; middleware and route handlers handle refresh persistence.
        }
      },
    },
  });
}

export async function createRouteHandlerSupabaseClient(response: NextResponse) {
  const { url, publishableKey } = assertSupabaseEnabled();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });
}

export function createAdminSupabaseClient() {
  if (!appConfig.hasSupabaseUrl || !appConfig.hasSupabaseServiceRole) {
    throw new Error("Supabase admin client is not configured.");
  }

  return createClient(
    getSupabasePublicConfig().url,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
