const rawAuthMode = process.env.D3T_AUTH_MODE ?? "supabase";
const rawStoreMode = process.env.D3T_STORE_MODE ?? "postgres";
const rawRealtimeMode = process.env.D3T_REALTIME_MODE ?? "supabase";
const rawDevDemoMode = process.env.D3T_ENABLE_DEV_DEMO ?? "true";

const hasSupabaseUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const hasSupabaseAnonKey = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const hasSupabaseServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

export const appConfig = {
  appName: "D3T",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  authMode: rawAuthMode === "local" || rawAuthMode === "mock" ? "local" : "supabase",
  storeMode: rawStoreMode === "memory" ? "memory" : "postgres",
  realtimeMode: rawRealtimeMode === "mock" ? "mock" : "supabase",
  enableDevDemo: rawDevDemoMode !== "false",
  hasSupabaseUrl,
  hasSupabaseAnonKey,
  hasSupabaseServiceRole,
  hasSupabaseKeys: hasSupabaseUrl && hasSupabaseAnonKey,
  hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
  disconnectGraceMs: 2 * 60 * 1000,
  presenceHeartbeatMs: 15_000,
  challengeExpiryMs: 2 * 60 * 1000,
} as const;

export function isProduction() {
  return process.env.NODE_ENV === "production";
}

export function isSupabaseAuthEnabled() {
  return appConfig.authMode === "supabase" && appConfig.hasSupabaseKeys;
}

export function isLocalAuthEnabled() {
  return !isProduction() && !isSupabaseAuthEnabled();
}

export function isPostgresEnabled() {
  return appConfig.storeMode === "postgres" && appConfig.hasDatabaseUrl;
}

export function isSupabaseRealtimeEnabled() {
  return appConfig.realtimeMode === "supabase" && appConfig.hasSupabaseKeys;
}

export function isDevDemoEnabled() {
  return !isProduction() && appConfig.enableDevDemo && isLocalAuthEnabled();
}
