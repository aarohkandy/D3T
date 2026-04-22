import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isSupabaseAuthEnabled } from "@/lib/config";
import { getSupabasePublicConfig } from "@/lib/supabase/env";

export async function updateSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  if (!isSupabaseAuthEnabled()) {
    return response;
  }

  const { url, publishableKey } = getSupabasePublicConfig();
  const supabase = createServerClient(
    url,
    publishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  await supabase.auth.getUser();
  return response;
}
