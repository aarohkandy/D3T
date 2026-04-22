import "server-only";

import type { AppViewer } from "@/lib/auth/session";
import { appConfig, isPostgresEnabled } from "@/lib/config";
import { MOCK_VIEWERS } from "@/lib/dev/mock-session";
import {
  applyMoveToState,
  createInitialGameState,
  createRandomStarter,
  isLegalMove,
  oppositeMark,
  type D3TGameState,
  type D3TMark,
  type D3TMove,
} from "@/lib/d3t/engine";
import type {
  ChallengeAggregate,
  ChallengeStatus,
  GameAggregate,
  GameClockState,
  GameMode,
  GamePreset,
  GameStatus,
  HubData,
  MoveRecord,
  PlayerMark,
  TimePresetId,
  UserProfile,
} from "@/lib/data/types";
import { AppError } from "@/lib/data/errors";
import * as postgresStore from "@/lib/data/postgres-store";

const PRESETS: GamePreset[] = [
  {
    id: "bullet",
    label: "1 + 0",
    initialMs: 60_000,
    incrementMs: 0,
    rated: true,
    description: "Bullet",
  },
  {
    id: "blitz",
    label: "3 + 2",
    initialMs: 180_000,
    incrementMs: 2_000,
    rated: true,
    description: "Blitz",
  },
  {
    id: "rapid",
    label: "5 + 0",
    initialMs: 300_000,
    incrementMs: 0,
    rated: true,
    description: "Rapid",
  },
  {
    id: "classic",
    label: "10 + 0",
    initialMs: 600_000,
    incrementMs: 0,
    rated: true,
    description: "Classic",
  },
];

type PersistedGame = {
  id: string;
  roomId: string;
  inviteUrl: string;
  mode: GameMode;
  status: GameStatus;
  rated: boolean;
  presetId: TimePresetId;
  creatorId: string;
  playerXId: string | null;
  playerOId: string | null;
  starterId: string | null;
  currentTurnId: string | null;
  winnerId: string | null;
  challengeId: string | null;
  disconnectPlayerId: string | null;
  disconnectExpiresAt: Date | null;
  playerXLastSeenAt: Date | null;
  playerOLastSeenAt: Date | null;
  initialMs: number;
  incrementMs: number;
  playerXRemainingMs: number;
  playerORemainingMs: number;
  turnStartedAt: Date | null;
  state: D3TGameState;
  createdAt: Date;
  updatedAt: Date;
  finishedAt: Date | null;
};

type PersistedMove = {
  id: string;
  gameId: string;
  moveNumber: number;
  playerId: string;
  move: D3TMove;
  resultingState: D3TGameState;
  createdAt: Date;
};

type PersistedChallenge = {
  id: string;
  status: ChallengeStatus;
  fromUserId: string;
  toUserId: string;
  presetId: TimePresetId;
  gameId: string | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

type MemoryStore = {
  users: Map<string, UserProfile>;
  games: Map<string, PersistedGame>;
  moves: Map<string, PersistedMove[]>;
  challenges: Map<string, PersistedChallenge>;
};

declare global {
  var __d3tMemoryStore: MemoryStore | undefined;
}

function getMemoryStore(): MemoryStore {
  if (!global.__d3tMemoryStore) {
    global.__d3tMemoryStore = {
      users: new Map(),
      games: new Map(),
      moves: new Map(),
      challenges: new Map(),
    };
  }

  return global.__d3tMemoryStore;
}

function now() {
  return new Date();
}

function randomId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

function toIso(value: Date | null) {
  return value ? value.toISOString() : null;
}

function sanitizeUsername(raw: string) {
  const normalized = raw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 18);

  return normalized.length > 1 ? normalized : `player${Math.floor(Math.random() * 9999)}`;
}

export function getPresetOptions() {
  return PRESETS;
}

export function getPresetById(presetId?: string | null) {
  return PRESETS.find((preset) => preset.id === presetId) ?? PRESETS[1];
}

function getPresetSummary(presetId: TimePresetId) {
  return { ...getPresetById(presetId) };
}

function getUserMap(ids: Array<string | null | undefined>) {
  const store = getMemoryStore();
  const entries = Array.from(new Set(ids.filter(Boolean) as string[]))
    .map((id) => [id, store.users.get(id) ?? null] as const)
    .filter((entry): entry is readonly [string, UserProfile] => Boolean(entry[1]));

  return new Map(entries);
}

function getCurrentPlayerMark(game: PersistedGame, viewerId: string): PlayerMark | null {
  if (game.playerXId === viewerId) {
    return "X";
  }

  if (game.playerOId === viewerId) {
    return "O";
  }

  return null;
}

function getOpponentId(game: PersistedGame, viewerId: string) {
  if (game.playerXId === viewerId) {
    return game.playerOId;
  }

  if (game.playerOId === viewerId) {
    return game.playerXId;
  }

  return null;
}

function createClockState(game: PersistedGame, at = now()): GameClockState {
  let playerXRemainingMs = game.playerXRemainingMs;
  let playerORemainingMs = game.playerORemainingMs;
  let expiresAt: string | null = null;

  if (game.status === "active" && game.currentTurnId && game.turnStartedAt) {
    const elapsedMs = Math.max(0, at.getTime() - game.turnStartedAt.getTime());

    if (game.currentTurnId === game.playerXId) {
      playerXRemainingMs = Math.max(0, playerXRemainingMs - elapsedMs);
      expiresAt = new Date(game.turnStartedAt.getTime() + game.playerXRemainingMs).toISOString();
    } else if (game.currentTurnId === game.playerOId) {
      playerORemainingMs = Math.max(0, playerORemainingMs - elapsedMs);
      expiresAt = new Date(game.turnStartedAt.getTime() + game.playerORemainingMs).toISOString();
    }
  }

  return {
    initialMs: game.initialMs,
    incrementMs: game.incrementMs,
    playerXRemainingMs,
    playerORemainingMs,
    turnStartedAt: toIso(game.turnStartedAt),
    expiresAt,
  };
}

function resolveClockExpiry(game: PersistedGame, at = now()) {
  const clock = createClockState(game, at);

  if (game.status !== "active") {
    return false;
  }

  if (clock.playerXRemainingMs > 0 && clock.playerORemainingMs > 0) {
    return false;
  }

  const loserId = clock.playerXRemainingMs <= 0 ? game.playerXId : game.playerOId;
  game.playerXRemainingMs = clock.playerXRemainingMs;
  game.playerORemainingMs = clock.playerORemainingMs;
  game.status = "finished";
  game.currentTurnId = null;
  game.turnStartedAt = null;
  game.finishedAt = at;
  game.updatedAt = at;
  game.winnerId = loserId ? getOpponentId(game, loserId) : null;

  return true;
}

function resolveDisconnectState(game: PersistedGame, at = now()) {
  if (game.status !== "active" || !game.playerXId || !game.playerOId) {
    game.disconnectPlayerId = null;
    game.disconnectExpiresAt = null;
    return;
  }

  const xMissing = !game.playerXLastSeenAt ||
    at.getTime() - game.playerXLastSeenAt.getTime() >= appConfig.disconnectGraceMs;
  const oMissing = !game.playerOLastSeenAt ||
    at.getTime() - game.playerOLastSeenAt.getTime() >= appConfig.disconnectGraceMs;

  if (xMissing === oMissing) {
    game.disconnectPlayerId = null;
    game.disconnectExpiresAt = null;
    return;
  }

  if (xMissing) {
    game.disconnectPlayerId = game.playerXId;
    game.disconnectExpiresAt = new Date(
      (game.playerXLastSeenAt?.getTime() ?? at.getTime()) + appConfig.disconnectGraceMs,
    );
    return;
  }

  game.disconnectPlayerId = game.playerOId;
  game.disconnectExpiresAt = new Date(
    (game.playerOLastSeenAt?.getTime() ?? at.getTime()) + appConfig.disconnectGraceMs,
  );
}

function finalizeStats(game: PersistedGame) {
  if (!game.playerXId || !game.playerOId) {
    return;
  }

  const store = getMemoryStore();
  const playerX = store.users.get(game.playerXId);
  const playerO = store.users.get(game.playerOId);

  if (!playerX || !playerO) {
    return;
  }

  const isDraw = !game.winnerId;

  if (isDraw) {
    playerX.draws += 1;
    playerO.draws += 1;
  } else if (game.winnerId === game.playerXId) {
    playerX.wins += 1;
    playerO.losses += 1;
  } else if (game.winnerId === game.playerOId) {
    playerO.wins += 1;
    playerX.losses += 1;
  }
}

function buildMoveRecord(move: PersistedMove): MoveRecord {
  return {
    id: move.id,
    gameId: move.gameId,
    moveNumber: move.moveNumber,
    playerId: move.playerId,
    move: move.move,
    resultingState: move.resultingState,
    createdAt: move.createdAt.toISOString(),
  };
}

function buildChallengeAggregate(challenge: PersistedChallenge): ChallengeAggregate {
  const users = getUserMap([challenge.fromUserId, challenge.toUserId]);
  return {
    id: challenge.id,
    status: challenge.status,
    fromUserId: challenge.fromUserId,
    toUserId: challenge.toUserId,
    preset: getPresetSummary(challenge.presetId),
    gameId: challenge.gameId,
    expiresAt: challenge.expiresAt.toISOString(),
    createdAt: challenge.createdAt.toISOString(),
    updatedAt: challenge.updatedAt.toISOString(),
    fromUser: users.get(challenge.fromUserId) ?? null,
    toUser: users.get(challenge.toUserId) ?? null,
  };
}

function buildGameAggregate(game: PersistedGame): GameAggregate {
  const users = getUserMap([game.playerXId, game.playerOId]);
  const store = getMemoryStore();
  const moves = (store.moves.get(game.id) ?? []).map(buildMoveRecord);

  return {
    id: game.id,
    roomId: game.roomId,
    inviteUrl: game.inviteUrl,
    mode: game.mode,
    status: game.status,
    rated: game.rated,
    preset: getPresetSummary(game.presetId),
    creatorId: game.creatorId,
    playerXId: game.playerXId,
    playerOId: game.playerOId,
    starterId: game.starterId,
    currentTurnId: game.currentTurnId,
    winnerId: game.winnerId,
    challengeId: game.challengeId,
    disconnectPlayerId: game.disconnectPlayerId,
    disconnectExpiresAt: toIso(game.disconnectExpiresAt),
    playerXLastSeenAt: toIso(game.playerXLastSeenAt),
    playerOLastSeenAt: toIso(game.playerOLastSeenAt),
    clock: createClockState(game),
    state: game.state,
    moves,
    playerX: game.playerXId ? users.get(game.playerXId) ?? null : null,
    playerO: game.playerOId ? users.get(game.playerOId) ?? null : null,
    createdAt: game.createdAt.toISOString(),
    updatedAt: game.updatedAt.toISOString(),
    finishedAt: toIso(game.finishedAt),
  };
}

function expireChallenges(at = now()) {
  const store = getMemoryStore();

  for (const challenge of store.challenges.values()) {
    if (challenge.status === "pending" && challenge.expiresAt.getTime() <= at.getTime()) {
      challenge.status = "expired";
      challenge.updatedAt = at;
    }
  }
}

function listChallengesForUser(userId: string, direction: "incoming" | "outgoing") {
  expireChallenges();
  const store = getMemoryStore();

  return Array.from(store.challenges.values())
    .filter((challenge) => direction === "incoming" ? challenge.toUserId === userId : challenge.fromUserId === userId)
    .filter((challenge) => ["pending", "accepted"].includes(challenge.status))
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}

function findActiveGameForUser(userId: string) {
  const store = getMemoryStore();

  return Array.from(store.games.values())
    .filter((game) => [game.playerXId, game.playerOId, game.creatorId].includes(userId))
    .find((game) => game.status === "active") ?? null;
}

function assertNoLiveCommitments(userId: string, options?: { ignoreChallengeId?: string }) {
  if (findActiveGameForUser(userId)) {
    throw new AppError("Finish your current game before starting another one.", 409);
  }

  const pendingChallenge = Array.from(getMemoryStore().challenges.values()).find(
    (challenge) =>
      challenge.id !== options?.ignoreChallengeId &&
      challenge.status === "pending" &&
      (challenge.fromUserId === userId || challenge.toUserId === userId),
  );

  if (pendingChallenge) {
    throw new AppError("Resolve your current challenge before starting another one.", 409);
  }
}

function createFreshGame(params: {
  mode: GameMode;
  presetId: TimePresetId;
  creatorId: string;
  playerXId: string;
  playerOId: string;
  rated: boolean;
  challengeId?: string | null;
}) {
  const timestamp = now();
  const preset = getPresetById(params.presetId);
  const starterMark = createRandomStarter() as PlayerMark;
  const starterId = starterMark === "X" ? params.playerXId : params.playerOId;
  const state = createInitialGameState(starterMark);

  const game: PersistedGame = {
    id: randomId("game"),
    roomId: "",
    inviteUrl: "",
    mode: params.mode,
    status: "active",
    rated: params.rated,
    presetId: preset.id,
    creatorId: params.creatorId,
    playerXId: params.playerXId,
    playerOId: params.playerOId,
    starterId,
    currentTurnId: starterId,
    winnerId: null,
    challengeId: params.challengeId ?? null,
    disconnectPlayerId: null,
    disconnectExpiresAt: null,
    playerXLastSeenAt: timestamp,
    playerOLastSeenAt: timestamp,
    initialMs: preset.initialMs,
    incrementMs: preset.incrementMs,
    playerXRemainingMs: preset.initialMs,
    playerORemainingMs: preset.initialMs,
    turnStartedAt: timestamp,
    state,
    createdAt: timestamp,
    updatedAt: timestamp,
    finishedAt: null,
  };

  game.roomId = `game:${game.id}`;
  game.inviteUrl = `${appConfig.appUrl}/play/${game.id}`;

  return game;
}

function getStoreUserByUsername(username: string) {
  const normalized = sanitizeUsername(username);
  return Array.from(getMemoryStore().users.values()).find((user) => user.username === normalized) ?? null;
}

export async function ensureViewerUser(viewer: AppViewer) {
  if (isPostgresEnabled()) {
    return postgresStore.ensureViewerUser(viewer);
  }

  const store = getMemoryStore();
  const existing = store.users.get(viewer.id);

  if (existing) {
    existing.email = viewer.email;
    existing.avatarUrl = viewer.avatarUrl;
    return existing;
  }

  const username = sanitizeUsername(viewer.username);
  const profile: UserProfile = {
    id: viewer.id,
    username,
    email: viewer.email,
    avatarUrl: viewer.avatarUrl,
    wins: 0,
    losses: 0,
    draws: 0,
  };

  store.users.set(profile.id, profile);
  return profile;
}

function hydrateMockOpponent(username: string) {
  const mockViewer = MOCK_VIEWERS.find((candidate) => candidate.username === username);
  return mockViewer ? ensureViewerUser(mockViewer) : null;
}

export async function getDashboardData(viewer: AppViewer): Promise<HubData> {
  if (isPostgresEnabled()) {
    return postgresStore.getDashboardData(viewer);
  }

  await ensureViewerUser(viewer);
  expireChallenges();

  const activeGame = findActiveGameForUser(viewer.id);
  if (activeGame) {
    if (resolveClockExpiry(activeGame)) {
      finalizeStats(activeGame);
    }
    resolveDisconnectState(activeGame);
  }
  return {
    viewer,
    activeGame: activeGame ? buildGameAggregate(activeGame) : null,
    incomingChallenges: listChallengesForUser(viewer.id, "incoming").map(buildChallengeAggregate),
    outgoingChallenges: listChallengesForUser(viewer.id, "outgoing").map(buildChallengeAggregate),
    presets: getPresetOptions(),
  };
}

export async function createChallenge(viewer: AppViewer, opponentUsername: string, presetId: TimePresetId) {
  if (isPostgresEnabled()) {
    return postgresStore.createChallenge(viewer, opponentUsername, presetId);
  }

  await ensureViewerUser(viewer);
  assertNoLiveCommitments(viewer.id);

  const normalized = sanitizeUsername(opponentUsername);
  let opponent = getStoreUserByUsername(normalized);

  if (!opponent && appConfig.authMode === "local") {
    opponent = await hydrateMockOpponent(normalized);
  }

  if (!opponent) {
    throw new AppError("That username does not exist.", 404);
  }

  if (opponent.id === viewer.id) {
    throw new AppError("You cannot challenge yourself.", 409);
  }

  assertNoLiveCommitments(opponent.id);

  const store = getMemoryStore();
  const challenge: PersistedChallenge = {
    id: randomId("challenge"),
    status: "pending",
    fromUserId: viewer.id,
    toUserId: opponent.id,
    presetId: getPresetById(presetId).id,
    gameId: null,
    expiresAt: new Date(now().getTime() + 2 * 60_000),
    createdAt: now(),
    updatedAt: now(),
  };

  store.challenges.set(challenge.id, challenge);
  return buildChallengeAggregate(challenge);
}

export async function acceptChallenge(viewer: AppViewer, challengeId: string) {
  if (isPostgresEnabled()) {
    return postgresStore.acceptChallenge(viewer, challengeId);
  }

  await ensureViewerUser(viewer);
  expireChallenges();

  const store = getMemoryStore();
  const challenge = store.challenges.get(challengeId);
  if (!challenge) {
    throw new AppError("Challenge not found.", 404);
  }

  if (challenge.toUserId !== viewer.id) {
    throw new AppError("This challenge does not belong to you.", 403);
  }

  if (challenge.status !== "pending") {
    throw new AppError("This challenge is no longer available.", 409);
  }

  assertNoLiveCommitments(viewer.id, { ignoreChallengeId: challenge.id });
  assertNoLiveCommitments(challenge.fromUserId, { ignoreChallengeId: challenge.id });

  const game = createFreshGame({
    mode: "challenge",
    presetId: challenge.presetId,
    creatorId: challenge.fromUserId,
    playerXId: challenge.fromUserId,
    playerOId: viewer.id,
    rated: false,
    challengeId: challenge.id,
  });

  challenge.status = "accepted";
  challenge.gameId = game.id;
  challenge.updatedAt = now();

  store.games.set(game.id, game);

  return {
    challenge: buildChallengeAggregate(challenge),
    game: buildGameAggregate(game),
  };
}

export async function declineChallenge(viewer: AppViewer, challengeId: string) {
  if (isPostgresEnabled()) {
    return postgresStore.declineChallenge(viewer, challengeId);
  }

  await ensureViewerUser(viewer);
  expireChallenges();

  const challenge = getMemoryStore().challenges.get(challengeId);
  if (!challenge) {
    throw new AppError("Challenge not found.", 404);
  }

  if (![challenge.fromUserId, challenge.toUserId].includes(viewer.id)) {
    throw new AppError("This challenge does not belong to you.", 403);
  }

  if (challenge.status !== "pending") {
    throw new AppError("This challenge has already been resolved.", 409);
  }

  challenge.status = "declined";
  challenge.updatedAt = now();

  return buildChallengeAggregate(challenge);
}

export async function getGameAggregate(viewer: AppViewer, gameId: string) {
  if (isPostgresEnabled()) {
    return postgresStore.getGameAggregate(viewer, gameId);
  }

  await ensureViewerUser(viewer);
  const store = getMemoryStore();
  const game = store.games.get(gameId);

  if (!game) {
    throw new AppError("Game not found.", 404);
  }

  if (![game.playerXId, game.playerOId, game.creatorId].includes(viewer.id)) {
    throw new AppError("This game does not belong to your account.", 403);
  }

  if (resolveClockExpiry(game)) {
    finalizeStats(game);
  }

  resolveDisconnectState(game);

  return buildGameAggregate(game);
}

function markToUserId(game: PersistedGame, mark: D3TMark) {
  return mark === "X" ? game.playerXId : game.playerOId;
}

export async function playMove(viewer: AppViewer, gameId: string, move: D3TMove) {
  if (isPostgresEnabled()) {
    return postgresStore.playMove(viewer, gameId, move);
  }

  await ensureViewerUser(viewer);
  const store = getMemoryStore();
  const game = store.games.get(gameId);

  if (!game) {
    throw new AppError("Game not found.", 404);
  }

  if (game.status !== "active") {
    throw new AppError("This game is not accepting moves.", 409);
  }

  if (resolveClockExpiry(game)) {
    finalizeStats(game);
    throw new AppError("Your clock has already expired.", 409);
  }

  if (game.currentTurnId !== viewer.id) {
    throw new AppError("It is not your turn.", 409);
  }

  const playerMark = getCurrentPlayerMark(game, viewer.id);
  if (!playerMark) {
    throw new AppError("You are not seated in this game.", 403);
  }

  if (!isLegalMove(game.state, move)) {
    throw new AppError("That move is not legal right now.", 422);
  }

  const beforeClock = createClockState(game);
  game.playerXRemainingMs = beforeClock.playerXRemainingMs;
  game.playerORemainingMs = beforeClock.playerORemainingMs;

  if (playerMark === "X") {
    game.playerXRemainingMs = Math.max(0, game.playerXRemainingMs + game.incrementMs);
  } else {
    game.playerORemainingMs = Math.max(0, game.playerORemainingMs + game.incrementMs);
  }

  const nextState = applyMoveToState(game.state, move, playerMark);
  game.state = nextState;
  game.updatedAt = now();
  game.playerXLastSeenAt = playerMark === "X" ? game.updatedAt : game.playerXLastSeenAt;
  game.playerOLastSeenAt = playerMark === "O" ? game.updatedAt : game.playerOLastSeenAt;

  const recordedMove: PersistedMove = {
    id: randomId("move"),
    gameId: game.id,
    moveNumber: (store.moves.get(game.id)?.length ?? 0) + 1,
    playerId: viewer.id,
    move,
    resultingState: nextState,
    createdAt: game.updatedAt,
  };

  const currentMoves = store.moves.get(game.id) ?? [];
  store.moves.set(game.id, [...currentMoves, recordedMove]);

  if (nextState.outcome === "active") {
    const nextMark = oppositeMark(playerMark);
    game.currentTurnId = markToUserId(game, nextMark);
    game.turnStartedAt = game.updatedAt;
    game.winnerId = null;
    game.disconnectPlayerId = null;
    game.disconnectExpiresAt = null;
  } else {
    game.status = "finished";
    game.currentTurnId = null;
    game.turnStartedAt = null;
    game.finishedAt = game.updatedAt;
    game.winnerId = nextState.winner ? markToUserId(game, nextState.winner) : null;
    finalizeStats(game);
  }

  return buildGameAggregate(game);
}

export async function resignGame(viewer: AppViewer, gameId: string) {
  if (isPostgresEnabled()) {
    return postgresStore.resignGame(viewer, gameId);
  }

  const store = getMemoryStore();
  const game = store.games.get(gameId);
  if (!game) {
    throw new AppError("Game not found.", 404);
  }

  if (game.status !== "active") {
    throw new AppError("Only active games can be resigned.", 409);
  }

  if (![game.playerXId, game.playerOId].includes(viewer.id)) {
    throw new AppError("You are not a player in this game.", 403);
  }

  game.status = "finished";
  game.currentTurnId = null;
  game.turnStartedAt = null;
  game.finishedAt = now();
  game.updatedAt = game.finishedAt;
  game.winnerId = getOpponentId(game, viewer.id);
  finalizeStats(game);

  return buildGameAggregate(game);
}

export async function touchPresence(viewer: AppViewer, gameId: string) {
  if (isPostgresEnabled()) {
    return postgresStore.touchPresence(viewer, gameId);
  }

  const store = getMemoryStore();
  const game = store.games.get(gameId);
  if (!game) {
    throw new AppError("Game not found.", 404);
  }

  if (![game.playerXId, game.playerOId].includes(viewer.id)) {
    throw new AppError("You are not seated in this game.", 403);
  }

  const stamp = now();
  if (game.playerXId === viewer.id) {
    game.playerXLastSeenAt = stamp;
  }
  if (game.playerOId === viewer.id) {
    game.playerOLastSeenAt = stamp;
  }

  game.updatedAt = stamp;
  resolveDisconnectState(game, stamp);
  return buildGameAggregate(game);
}

export async function claimForfeit(viewer: AppViewer, gameId: string) {
  if (isPostgresEnabled()) {
    return postgresStore.claimForfeit(viewer, gameId);
  }

  const store = getMemoryStore();
  const game = store.games.get(gameId);
  if (!game) {
    throw new AppError("Game not found.", 404);
  }

  if (![game.playerXId, game.playerOId].includes(viewer.id)) {
    throw new AppError("You are not seated in this game.", 403);
  }

  if (game.status !== "active") {
    throw new AppError("Only active games can be forfeited.", 409);
  }

  resolveDisconnectState(game);

  if (!game.disconnectPlayerId || !game.disconnectExpiresAt) {
    throw new AppError("No disconnect forfeit is available right now.", 409);
  }

  if (game.disconnectPlayerId === viewer.id) {
    throw new AppError("You cannot claim a disconnect forfeit against yourself.", 409);
  }

  if (game.disconnectExpiresAt.getTime() > now().getTime()) {
    throw new AppError("The disconnect timer has not expired yet.", 409);
  }

  game.status = "forfeit";
  game.currentTurnId = null;
  game.turnStartedAt = null;
  game.finishedAt = now();
  game.updatedAt = game.finishedAt;
  game.winnerId = viewer.id;
  game.disconnectPlayerId = null;
  game.disconnectExpiresAt = null;
  finalizeStats(game);

  return buildGameAggregate(game);
}

export async function rematchGame(viewer: AppViewer, gameId: string) {
  if (isPostgresEnabled()) {
    return postgresStore.rematchGame(viewer, gameId);
  }

  const store = getMemoryStore();
  const game = store.games.get(gameId);
  if (!game) {
    throw new AppError("Game not found.", 404);
  }

  if (!game.playerXId || !game.playerOId) {
    throw new AppError("Rematches need two players.", 409);
  }

  if (![game.playerXId, game.playerOId].includes(viewer.id)) {
    throw new AppError("You are not seated in this game.", 403);
  }

  const rematch = createFreshGame({
    mode: game.mode,
    presetId: game.presetId,
    creatorId: viewer.id,
    playerXId: game.playerXId,
    playerOId: game.playerOId,
    rated: game.rated,
    challengeId: null,
  });

  store.games.set(rematch.id, rematch);
  return buildGameAggregate(rematch);
}

export async function getPendingChallenges(viewer: AppViewer) {
  if (isPostgresEnabled()) {
    return postgresStore.getPendingChallenges(viewer);
  }

  await ensureViewerUser(viewer);
  return {
    incomingChallenges: listChallengesForUser(viewer.id, "incoming").map(buildChallengeAggregate),
    outgoingChallenges: listChallengesForUser(viewer.id, "outgoing").map(buildChallengeAggregate),
  };
}

export async function markForcedTargetHintSeen(viewer: AppViewer) {
  if (isPostgresEnabled()) {
    return postgresStore.markForcedTargetHintSeen(viewer);
  }

  return null;
}
