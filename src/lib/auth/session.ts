import "server-only";

import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { isDevDemoEnabled, isSupabaseAuthEnabled } from "@/lib/config";
import { getDb } from "@/lib/db/client";
import { profilesTable } from "@/lib/db/schema";
import {
  getMockViewer,
  LOCAL_VIEWER_COOKIE,
  MOCK_VIEWER_COOKIE,
  parseLocalViewer,
} from "@/lib/dev/mock-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AppViewer = {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  displayName: string;
  isMock: boolean;
  hasSeenForcedTargetHint: boolean;
};

function sanitizeUsername(raw: string) {
  const normalized = raw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 18);

  return normalized.length > 1 ? normalized : `player${Math.floor(Math.random() * 9999)}`;
}

async function ensureSupabaseProfile(params: {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}) {
  const db = getDb();
  if (!db) {
    return null;
  }

  const existing = await db.query.profilesTable.findFirst({
    where: eq(profilesTable.id, params.id),
  });

  if (existing) {
    return existing;
  }

  const baseUsername = sanitizeUsername(params.username);
  let username = baseUsername;
  let suffix = 1;

  while (
    await db.query.profilesTable.findFirst({
      where: eq(profilesTable.username, username),
    })
  ) {
    suffix += 1;
    username = `${baseUsername.slice(0, Math.max(2, 18 - String(suffix).length))}${suffix}`;
  }

  const inserted = await db
    .insert(profilesTable)
    .values({
      id: params.id,
      username,
      displayName: params.displayName,
      email: params.email,
      avatarUrl: params.avatarUrl,
      hasSeenForcedTargetHint: 0,
    })
    .returning();

  return inserted[0] ?? null;
}

export async function getViewer(): Promise<AppViewer | null> {
  if (isSupabaseAuthEnabled()) {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const profile = await ensureSupabaseProfile({
      id: user.id,
      email: user.email ?? `${user.id}@d3t.app`,
      username:
        (typeof user.user_metadata.username === "string" && user.user_metadata.username) ||
        user.email?.split("@")[0] ||
        user.id.slice(-8),
      displayName:
        (typeof user.user_metadata.display_name === "string" && user.user_metadata.display_name) ||
        (typeof user.user_metadata.full_name === "string" && user.user_metadata.full_name) ||
        "D3T Player",
      avatarUrl: typeof user.user_metadata.avatar_url === "string" ? user.user_metadata.avatar_url : null,
    });

    return {
      id: user.id,
      username: profile?.username ?? sanitizeUsername(user.email?.split("@")[0] ?? user.id.slice(-8)),
      email: user.email ?? `${user.id}@d3t.app`,
      avatarUrl: profile?.avatarUrl ?? (typeof user.user_metadata.avatar_url === "string" ? user.user_metadata.avatar_url : null),
      displayName: profile?.displayName ?? "D3T Player",
      isMock: false,
      hasSeenForcedTargetHint: Boolean(profile?.hasSeenForcedTargetHint),
    };
  }

  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const headerMockUserId = headerStore.get("x-d3t-mock-user");
  const serializedLocalViewer = cookieStore.get(LOCAL_VIEWER_COOKIE)?.value;
  const legacyMockViewerId = cookieStore.get(MOCK_VIEWER_COOKIE)?.value;

  if (headerMockUserId) {
    return getMockViewer(headerMockUserId);
  }

  const localViewer = parseLocalViewer(serializedLocalViewer);
  if (localViewer) {
    return {
      ...localViewer,
      hasSeenForcedTargetHint: false,
    };
  }

  if (legacyMockViewerId) {
    return {
      ...getMockViewer(legacyMockViewerId),
      hasSeenForcedTargetHint: false,
    };
  }

  return null;
}

export async function requireViewer() {
  const viewer = await getViewer();

  if (viewer) {
    return viewer;
  }

  if (isSupabaseAuthEnabled()) {
    redirect("/sign-in");
  }

  if (isDevDemoEnabled()) {
    redirect("/dev/demo");
  }

  redirect("/sign-in");
}

export async function requireApiViewer() {
  const viewer = await getViewer();

  if (!viewer) {
    throw new Error("Unauthorized");
  }

  return viewer;
}
