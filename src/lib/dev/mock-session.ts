import type { AppViewer } from "@/lib/auth/session";

export const LOCAL_VIEWER_COOKIE = "d3t_local_viewer";
export const MOCK_VIEWER_COOKIE = LOCAL_VIEWER_COOKIE;
export const LOCAL_VIEWER_MAX_AGE = 60 * 60 * 24 * 30;

export const MOCK_VIEWERS: AppViewer[] = [
  {
    id: "dev-user-1",
    username: "boardbuilder",
    email: "boardbuilder@localhost.test",
    avatarUrl: null,
    displayName: "Board Builder",
    isMock: true,
    hasSeenForcedTargetHint: false,
  },
  {
    id: "dev-user-2",
    username: "forktrap",
    email: "forktrap@localhost.test",
    avatarUrl: null,
    displayName: "Fork Trap",
    isMock: true,
    hasSeenForcedTargetHint: false,
  },
  {
    id: "dev-user-3",
    username: "middlegame",
    email: "middlegame@localhost.test",
    avatarUrl: null,
    displayName: "Middle Game",
    isMock: true,
    hasSeenForcedTargetHint: false,
  },
  {
    id: "dev-user-4",
    username: "endgrid",
    email: "endgrid@localhost.test",
    avatarUrl: null,
    displayName: "End Grid",
    isMock: true,
    hasSeenForcedTargetHint: false,
  },
];

type LocalAuthRegistry = {
  usersById: Map<string, AppViewer>;
  usersByUsername: Map<string, AppViewer>;
};

declare global {
  var __d3tLocalAuthRegistry: LocalAuthRegistry | undefined;
}

function getRegistry(): LocalAuthRegistry {
  if (!global.__d3tLocalAuthRegistry) {
    const usersById = new Map<string, AppViewer>();
    const usersByUsername = new Map<string, AppViewer>();

    for (const viewer of MOCK_VIEWERS) {
      usersById.set(viewer.id, viewer);
      usersByUsername.set(viewer.username, viewer);
    }

    global.__d3tLocalAuthRegistry = {
      usersById,
      usersByUsername,
    };
  }

  return global.__d3tLocalAuthRegistry;
}

export const MOCK_VIEWER = MOCK_VIEWERS[0];

export function normalizeUsername(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 18);
}

export function normalizeDisplayName(raw: string, fallbackUsername: string) {
  const cleaned = raw.trim().replace(/\s+/g, " ").slice(0, 32);
  return cleaned || fallbackUsername;
}

export function normalizeEmail(raw: string, username: string) {
  const cleaned = raw.trim().toLowerCase();
  return cleaned || `${username}@localhost.test`;
}

export function listLocalViewers() {
  return Array.from(getRegistry().usersById.values());
}

export function registerLocalViewer(viewer: AppViewer) {
  const registry = getRegistry();
  registry.usersById.set(viewer.id, viewer);
  registry.usersByUsername.set(viewer.username, viewer);
  return viewer;
}

export function getMockViewer(mockUserId?: string | null) {
  if (!mockUserId) {
    return MOCK_VIEWER;
  }

  return getRegistry().usersById.get(mockUserId) ?? MOCK_VIEWER;
}

export function getLocalViewerByUsername(username: string) {
  const normalized = normalizeUsername(username);
  return normalized ? getRegistry().usersByUsername.get(normalized) ?? null : null;
}

export function createLocalViewer(input: {
  username: string;
  displayName?: string;
  email?: string;
}) {
  const username = normalizeUsername(input.username);
  if (!username || username.length < 2) {
    throw new Error("Username must be at least 2 characters.");
  }

  const displayName = normalizeDisplayName(input.displayName ?? "", username);
  const email = normalizeEmail(input.email ?? "", username);

  return registerLocalViewer({
    id: `local_${crypto.randomUUID().replace(/-/g, "")}`,
    username,
    email,
    avatarUrl: null,
    displayName,
    isMock: true,
    hasSeenForcedTargetHint: false,
  });
}

export function serializeLocalViewer(viewer: AppViewer) {
  const payload = JSON.stringify({
    id: viewer.id,
    username: viewer.username,
    email: viewer.email,
    avatarUrl: viewer.avatarUrl,
    displayName: viewer.displayName,
    isMock: true,
    hasSeenForcedTargetHint: viewer.hasSeenForcedTargetHint,
  });

  return Buffer.from(payload, "utf8").toString("base64url");
}

export function parseLocalViewer(serialized?: string | null) {
  if (!serialized) {
    return null;
  }

  try {
    const decoded = Buffer.from(serialized, "base64url").toString("utf8");
    const payload = JSON.parse(decoded) as Partial<AppViewer>;

    if (!payload.id || !payload.username || !payload.email || !payload.displayName) {
      return null;
    }

    const viewer: AppViewer = {
      id: payload.id,
      username: normalizeUsername(payload.username),
      email: payload.email,
      avatarUrl: payload.avatarUrl ?? null,
      displayName: payload.displayName,
      isMock: true,
      hasSeenForcedTargetHint: Boolean(payload.hasSeenForcedTargetHint),
    };

    return registerLocalViewer(viewer);
  } catch {
    return null;
  }
}
