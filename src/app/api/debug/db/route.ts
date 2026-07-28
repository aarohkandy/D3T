import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { requireApiViewer } from "@/lib/auth/session";
import {
  appConfig,
  isPostgresEnabled,
  isSupabaseAuthEnabled,
  isSupabaseRealtimeEnabled,
} from "@/lib/config";
import { runDbDiagnostic } from "@/lib/db/client";

export async function GET() {
  try {
    await requireApiViewer();

    const diagnostic = await runDbDiagnostic();

    return NextResponse.json({
      runtime: {
        authMode: appConfig.authMode,
        storeMode: appConfig.storeMode,
        realtimeMode: appConfig.realtimeMode,
        hasSupabaseUrl: appConfig.hasSupabaseUrl,
        hasSupabasePublishableKey: appConfig.hasSupabasePublishableKey,
        hasSupabaseServiceRole: appConfig.hasSupabaseServiceRole,
        hasDatabaseUrl: appConfig.hasDatabaseUrl,
        hasProductionBackend: appConfig.hasProductionBackend,
        isSupabaseAuthEnabled: isSupabaseAuthEnabled(),
        isPostgresEnabled: isPostgresEnabled(),
        isSupabaseRealtimeEnabled: isSupabaseRealtimeEnabled(),
        hasPoolerHostOverride: Boolean(process.env.SUPABASE_POOLER_HOST),
      },
      diagnostic,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
