const SUPABASE_POOLER_HOST_SUFFIX = ".pooler.supabase.com";

function getSupabaseProjectRef(supabaseUrl?: string | null) {
  if (!supabaseUrl) {
    return null;
  }

  try {
    const hostname = new URL(supabaseUrl).hostname;
    const [projectRef] = hostname.split(".");
    return projectRef || null;
  } catch {
    return null;
  }
}

export function normalizeDatabaseUrl(rawUrl: string, supabaseUrl?: string | null) {
  try {
    const url = new URL(rawUrl);
    const projectRef = getSupabaseProjectRef(supabaseUrl);
    const username = decodeURIComponent(url.username);

    if (
      projectRef &&
      url.hostname.endsWith(SUPABASE_POOLER_HOST_SUFFIX) &&
      username &&
      !username.includes(".")
    ) {
      url.username = `${username}.${projectRef}`;
    }

    if (url.hostname.endsWith(SUPABASE_POOLER_HOST_SUFFIX) && !url.searchParams.has("sslmode")) {
      url.searchParams.set("sslmode", "require");
    }

    return url.toString();
  } catch {
    return rawUrl;
  }
}

export function getDatabaseUrlDiagnostic(rawUrl: string, supabaseUrl?: string | null) {
  try {
    const original = new URL(rawUrl);
    const normalized = new URL(normalizeDatabaseUrl(rawUrl, supabaseUrl));
    const projectRef = getSupabaseProjectRef(supabaseUrl);
    const originalUsername = decodeURIComponent(original.username);
    const normalizedUsername = decodeURIComponent(normalized.username);

    return {
      host: original.hostname,
      isPooler: original.hostname.endsWith(SUPABASE_POOLER_HOST_SUFFIX),
      projectRef,
      usernameHasProjectRef: Boolean(projectRef && originalUsername.endsWith(`.${projectRef}`)),
      usernameHasDot: originalUsername.includes("."),
      normalizedUsernameChanged: originalUsername !== normalizedUsername,
      hasPassword: Boolean(original.password),
      hasSslMode: original.searchParams.has("sslmode") || normalized.searchParams.has("sslmode"),
    };
  } catch {
    return {
      invalidUrl: true,
    };
  }
}
