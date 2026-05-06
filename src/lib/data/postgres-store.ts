import "server-only";

import { and, eq, inArray, isNull, or } from "drizzle-orm";

import type { AppViewer } from "@/lib/auth/session";
import { appConfig } from "@/lib/config";
import { getDb } from "@/lib/db/client";
import { challengesTable, gamesTable, movesTable, profilesTable, type DbChallenge, type DbGame, type DbMove, type DbProfile } from "@/lib/db/schema";
import {
  applyMoveToState,
  createInitialGameState,
  createRandomStarter,
  isLegalMove,
  oppositeMark,
  type D3TGameState,
  type D3TMove,
} from "@/lib/d3t/engine";
import { chooseBotMove, getBotThinkTimeMs } from "@/lib/d3t/bot";
import { AppError } from "@/lib/data/errors";
import type {
  ChallengeAggregate,
  ChallengeStatus,
  GameAggregate,
  GameClockState,
  GameMode,
  GamePreset,
  GameStatus,
  HubData,
  QuickplayState,
  MoveRecord,
  PlayerMark,
  TimePresetId,
  UserProfile,
} from "@/lib/data/types";
import {
  getBuiltInBot,
  getQuickplayBotDelayMs,
  getStaticRatingForUser,
  isAutomatedPlayerId,
  pickBotForRating,
} from "@/lib/data/bots";

const PRESETS: GamePreset[] = [
  { id: "bullet", label: "1 + 0", initialMs: 60_000, incrementMs: 0, rated: true, description: "Bullet" },
  { id: "blitz", label: "3 + 2", initialMs: 180_000, incrementMs: 2_000, rated: true, description: "Blitz" },
  { id: "rapid", label: "5 + 0", initialMs: 300_000, incrementMs: 0, rated: true, description: "Rapid" },
  { id: "classic", label: "10 + 0", initialMs: 600_000, incrementMs: 0, rated: true, description: "Classic" },
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
  statsFinalized: boolean;
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

function requireDb() {
  const db = getDb();
  if (!db) {
    throw new AppError("Database is not configured.", 500);
  }
  return db;
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
  const normalized = raw.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 18);
  return normalized.length > 1 ? normalized : `player${Math.floor(Math.random() * 9999)}`;
}

function getPresetById(presetId?: string | null) {
  return PRESETS.find((preset) => preset.id === presetId) ?? PRESETS[1];
}

function getPresetSummary(presetId: TimePresetId) {
  return { ...getPresetById(presetId) };
}

function rowToProfile(row: DbProfile): UserProfile {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    avatarUrl: row.avatarUrl,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    quickplayRating: row.quickplayRating,
    quickplayGamesPlayed: row.quickplayGamesPlayed,
  };
}

function rowToGame(row: DbGame): PersistedGame {
  return {
    id: row.id,
    roomId: row.roomId,
    inviteUrl: row.inviteUrl,
    mode: row.mode,
    status: row.status,
    rated: Boolean(row.rated),
    presetId: row.presetId,
    creatorId: row.creatorId,
    playerXId: row.playerXId,
    playerOId: row.playerOId,
    starterId: row.starterId,
    currentTurnId: row.currentTurnId,
    winnerId: row.winnerId,
    challengeId: row.challengeId,
    disconnectPlayerId: row.disconnectPlayerId,
    disconnectExpiresAt: row.disconnectExpiresAt,
    playerXLastSeenAt: row.playerXLastSeenAt,
    playerOLastSeenAt: row.playerOLastSeenAt,
    initialMs: row.initialMs,
    incrementMs: row.incrementMs,
    playerXRemainingMs: row.playerXRemainingMs,
    playerORemainingMs: row.playerORemainingMs,
    turnStartedAt: row.turnStartedAt,
    state: row.currentStateJson,
    statsFinalized: Boolean(row.statsFinalized),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    finishedAt: row.finishedAt,
  };
}

function rowToMove(row: DbMove): PersistedMove {
  return {
    id: row.id,
    gameId: row.gameId,
    moveNumber: row.moveNumber,
    playerId: row.playerId,
    move: row.moveJson,
    resultingState: row.resultingStateJson,
    createdAt: row.createdAt,
  };
}

function rowToChallenge(row: DbChallenge): PersistedChallenge {
  return {
    id: row.id,
    status: row.status,
    fromUserId: row.fromUserId,
    toUserId: row.toUserId,
    presetId: row.presetId,
    gameId: row.gameId,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
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

function markToUserId(game: PersistedGame, mark: PlayerMark) {
  return mark === "X" ? game.playerXId : game.playerOId;
}

function isBotGame(game: PersistedGame) {
  return isAutomatedPlayerId(game.playerXId) || isAutomatedPlayerId(game.playerOId);
}

async function resolveQuickplayRating(userId?: string | null) {
  if (!userId) {
    return 1200;
  }

  const builtIn = getStaticRatingForUser(userId);
  if (typeof builtIn === "number") {
    return builtIn;
  }

  const row = await requireDb().query.profilesTable.findFirst({
    where: eq(profilesTable.id, userId),
  });

  return row?.quickplayRating ?? 1200;
}

function pickSeatOrder(firstPlayerId: string, secondPlayerId: string) {
  return createRandomStarter(() => Math.random()) === "X"
    ? [firstPlayerId, secondPlayerId] as const
    : [secondPlayerId, firstPlayerId] as const;
}

function createPendingQuickplayGame(creatorId: string, presetId: TimePresetId) {
  const timestamp = now();
  const preset = getPresetById(presetId);
  const game: PersistedGame = {
    id: randomId("game"),
    roomId: "",
    inviteUrl: "",
    mode: "quickplay",
    status: "pending",
    rated: true,
    presetId: preset.id,
    creatorId,
    playerXId: creatorId,
    playerOId: null,
    starterId: null,
    currentTurnId: null,
    winnerId: null,
    challengeId: null,
    disconnectPlayerId: null,
    disconnectExpiresAt: null,
    playerXLastSeenAt: timestamp,
    playerOLastSeenAt: null,
    initialMs: preset.initialMs,
    incrementMs: preset.incrementMs,
    playerXRemainingMs: preset.initialMs,
    playerORemainingMs: preset.initialMs,
    turnStartedAt: null,
    state: createInitialGameState("X"),
    statsFinalized: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    finishedAt: null,
  };

  game.roomId = `game:${game.id}`;
  game.inviteUrl = `${appConfig.appUrl}/play/${game.id}`;
  return game;
}

function activateQuickplayGame(game: PersistedGame, firstPlayerId: string, secondPlayerId: string) {
  const timestamp = now();
  const preset = getPresetById(game.presetId);
  const [playerXId, playerOId] = pickSeatOrder(firstPlayerId, secondPlayerId);
  const starterMark = createRandomStarter() as PlayerMark;
  const starterId = starterMark === "X" ? playerXId : playerOId;

  game.status = "active";
  game.mode = "quickplay";
  game.rated = true;
  game.playerXId = playerXId;
  game.playerOId = playerOId;
  game.starterId = starterId;
  game.currentTurnId = starterId;
  game.winnerId = null;
  game.challengeId = null;
  game.disconnectPlayerId = null;
  game.disconnectExpiresAt = null;
  game.playerXLastSeenAt = timestamp;
  game.playerOLastSeenAt = timestamp;
  game.initialMs = preset.initialMs;
  game.incrementMs = preset.incrementMs;
  game.playerXRemainingMs = preset.initialMs;
  game.playerORemainingMs = preset.initialMs;
  game.turnStartedAt = timestamp;
  game.state = createInitialGameState(starterMark);
  game.updatedAt = timestamp;
  game.finishedAt = null;
  game.statsFinalized = false;
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
  if (game.status !== "active" || !game.playerXId || !game.playerOId || isBotGame(game)) {
    game.disconnectPlayerId = null;
    game.disconnectExpiresAt = null;
    return;
  }

  const xMissing = !game.playerXLastSeenAt || at.getTime() - game.playerXLastSeenAt.getTime() >= appConfig.disconnectGraceMs;
  const oMissing = !game.playerOLastSeenAt || at.getTime() - game.playerOLastSeenAt.getTime() >= appConfig.disconnectGraceMs;

  if (xMissing === oMissing) {
    game.disconnectPlayerId = null;
    game.disconnectExpiresAt = null;
    return;
  }

  if (xMissing) {
    game.disconnectPlayerId = game.playerXId;
    game.disconnectExpiresAt = new Date((game.playerXLastSeenAt?.getTime() ?? at.getTime()) + appConfig.disconnectGraceMs);
    return;
  }

  game.disconnectPlayerId = game.playerOId;
  game.disconnectExpiresAt = new Date((game.playerOLastSeenAt?.getTime() ?? at.getTime()) + appConfig.disconnectGraceMs);
}

function getRuntimeSignature(game: PersistedGame) {
  return JSON.stringify({
    status: game.status,
    winnerId: game.winnerId,
    currentTurnId: game.currentTurnId,
    disconnectPlayerId: game.disconnectPlayerId,
    disconnectExpiresAt: toIso(game.disconnectExpiresAt),
    playerXRemainingMs: game.playerXRemainingMs,
    playerORemainingMs: game.playerORemainingMs,
    turnStartedAt: toIso(game.turnStartedAt),
    finishedAt: toIso(game.finishedAt),
    statsFinalized: game.statsFinalized,
  });
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

function buildChallengeAggregate(challenge: PersistedChallenge, users: Map<string, UserProfile>): ChallengeAggregate {
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

function buildGameAggregate(game: PersistedGame, moves: PersistedMove[], users: Map<string, UserProfile>): GameAggregate {
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
    moves: moves.map(buildMoveRecord),
    playerX: game.playerXId ? users.get(game.playerXId) ?? null : null,
    playerO: game.playerOId ? users.get(game.playerOId) ?? null : null,
    createdAt: game.createdAt.toISOString(),
    updatedAt: game.updatedAt.toISOString(),
    finishedAt: toIso(game.finishedAt),
  };
}

function buildQuickplayState(params?: {
  game?: PersistedGame | null;
  aggregate?: GameAggregate | null;
}): QuickplayState {
  if (!params?.game) {
    return {
      status: "idle",
      preset: null,
      queuedAt: null,
      game: null,
    };
  }

  if (params.game.status === "active") {
    return {
      status: "matched",
      preset: getPresetSummary(params.game.presetId),
      queuedAt: params.game.createdAt.toISOString(),
      game: params.aggregate ?? null,
    };
  }

  return {
    status: "searching",
    preset: getPresetSummary(params.game.presetId),
    queuedAt: params.game.createdAt.toISOString(),
    game: null,
  };
}

async function getUserMap(ids: Array<string | null | undefined>) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean) as string[]));
  if (!uniqueIds.length) {
    return new Map<string, UserProfile>();
  }

  const db = requireDb();
  const rows = await db.query.profilesTable.findMany({
    where: inArray(profilesTable.id, uniqueIds),
  });

  const users = new Map(rows.map((row) => [row.id, rowToProfile(row)]));
  for (const id of uniqueIds) {
    const bot = getBuiltInBot(id);
    if (bot) {
      users.set(id, bot);
    }
  }

  return users;
}

async function loadGameById(gameId: string) {
  const db = requireDb();
  const row = await db.query.gamesTable.findFirst({
    where: eq(gamesTable.id, gameId),
  });
  return row ? rowToGame(row) : null;
}

async function insertGame(db: ReturnType<typeof requireDb>, game: PersistedGame) {
  await db.insert(gamesTable).values({
    id: game.id,
    roomId: game.roomId,
    inviteUrl: game.inviteUrl,
    mode: game.mode,
    status: game.status,
    rated: game.rated ? 1 : 0,
    presetId: game.presetId,
    creatorId: game.creatorId,
    playerXId: game.playerXId,
    playerOId: game.playerOId,
    starterId: game.starterId,
    currentTurnId: game.currentTurnId,
    winnerId: game.winnerId,
    challengeId: game.challengeId,
    disconnectPlayerId: game.disconnectPlayerId,
    disconnectExpiresAt: game.disconnectExpiresAt,
    playerXLastSeenAt: game.playerXLastSeenAt,
    playerOLastSeenAt: game.playerOLastSeenAt,
    initialMs: game.initialMs,
    incrementMs: game.incrementMs,
    playerXRemainingMs: game.playerXRemainingMs,
    playerORemainingMs: game.playerORemainingMs,
    turnStartedAt: game.turnStartedAt,
    currentStateJson: game.state,
    statsFinalized: game.statsFinalized ? 1 : 0,
    createdAt: game.createdAt,
    updatedAt: game.updatedAt,
    finishedAt: game.finishedAt,
  });
}

async function deleteGameById(gameId: string) {
  await requireDb().delete(gamesTable).where(eq(gamesTable.id, gameId));
}

async function getPendingQuickplayForUser(userId: string) {
  const row = await requireDb().query.gamesTable.findFirst({
    where: and(
      eq(gamesTable.mode, "quickplay"),
      eq(gamesTable.status, "pending"),
      or(eq(gamesTable.playerXId, userId), eq(gamesTable.playerOId, userId), eq(gamesTable.creatorId, userId)),
    ),
    orderBy: (table, { asc }) => [asc(table.createdAt)],
  });

  return row ? rowToGame(row) : null;
}

async function listQuickplayCandidates(userId: string, presetId: TimePresetId) {
  const rows = await requireDb().query.gamesTable.findMany({
    where: and(
      eq(gamesTable.mode, "quickplay"),
      eq(gamesTable.status, "pending"),
      eq(gamesTable.presetId, presetId),
    ),
    orderBy: (table, { asc }) => [asc(table.createdAt)],
  });

  return rows
    .map(rowToGame)
    .filter((game) => ![game.playerXId, game.playerOId, game.creatorId].includes(userId));
}

async function applyRecordedMove(game: PersistedGame, playerId: string, move: D3TMove) {
  if (game.status !== "active") {
    throw new AppError("This game is not accepting moves.", 409);
  }

  const playerMark = getCurrentPlayerMark(game, playerId);
  if (!playerMark) {
    throw new AppError("You are not seated in this game.", 403);
  }

  if (!isLegalMove(game.state, move)) {
    throw new AppError("That move is not legal right now.", 422);
  }

  const db = requireDb();
  const previousTurnStartedAt = game.turnStartedAt;
  const beforeClock = createClockState(game);
  game.playerXRemainingMs = beforeClock.playerXRemainingMs;
  game.playerORemainingMs = beforeClock.playerORemainingMs;

  if (playerMark === "X") {
    game.playerXRemainingMs = Math.max(0, game.playerXRemainingMs + game.incrementMs);
  } else {
    game.playerORemainingMs = Math.max(0, game.playerORemainingMs + game.incrementMs);
  }

  const updatedAt = now();
  const nextState = applyMoveToState(game.state, move, playerMark);
  game.state = nextState;
  game.updatedAt = updatedAt;
  game.playerXLastSeenAt = playerMark === "X" ? updatedAt : game.playerXLastSeenAt;
  game.playerOLastSeenAt = playerMark === "O" ? updatedAt : game.playerOLastSeenAt;

  const recordedMove: PersistedMove = {
    id: randomId("move"),
    gameId: game.id,
    moveNumber: nextState.moveCount,
    playerId,
    move,
    resultingState: nextState,
    createdAt: updatedAt,
  };

  if (nextState.outcome === "active") {
    const nextMark = oppositeMark(playerMark);
    game.currentTurnId = markToUserId(game, nextMark);
    game.turnStartedAt = updatedAt;
    game.winnerId = null;
    game.disconnectPlayerId = null;
    game.disconnectExpiresAt = null;
  } else {
    game.status = "finished";
    game.currentTurnId = null;
    game.turnStartedAt = null;
    game.finishedAt = updatedAt;
    game.winnerId = nextState.winner ? markToUserId(game, nextState.winner) : null;
  }

  await db.transaction(async (tx) => {
    const claimed = await tx
      .update(gamesTable)
      .set({
        status: game.status,
        currentTurnId: game.currentTurnId,
        winnerId: game.winnerId,
        disconnectPlayerId: game.disconnectPlayerId,
        disconnectExpiresAt: game.disconnectExpiresAt,
        playerXLastSeenAt: game.playerXLastSeenAt,
        playerOLastSeenAt: game.playerOLastSeenAt,
        playerXRemainingMs: game.playerXRemainingMs,
        playerORemainingMs: game.playerORemainingMs,
        turnStartedAt: game.turnStartedAt,
        currentStateJson: game.state,
        statsFinalized: game.statsFinalized ? 1 : 0,
        updatedAt: game.updatedAt,
        finishedAt: game.finishedAt,
      })
      .where(
        and(
          eq(gamesTable.id, game.id),
          eq(gamesTable.status, "active"),
          eq(gamesTable.currentTurnId, playerId),
          previousTurnStartedAt ? eq(gamesTable.turnStartedAt, previousTurnStartedAt) : isNull(gamesTable.turnStartedAt),
        ),
      )
      .returning({ id: gamesTable.id });

    if (claimed.length === 0) {
      throw new AppError("This game changed before your move was saved. Refresh and try again.", 409);
    }

    await tx.insert(movesTable).values({
      id: recordedMove.id,
      gameId: recordedMove.gameId,
      moveNumber: recordedMove.moveNumber,
      playerId: recordedMove.playerId,
      moveJson: recordedMove.move,
      resultingStateJson: recordedMove.resultingState,
      createdAt: recordedMove.createdAt,
    });
  });

  if (game.status !== "active") {
    await persistStats(game);
  }

  return recordedMove;
}

async function maybePlayBotTurn(game: PersistedGame) {
  if (game.status !== "active" || !game.currentTurnId || !isAutomatedPlayerId(game.currentTurnId)) {
    return false;
  }

  if (resolveClockExpiry(game)) {
    await saveGame(requireDb(), game);
    await persistStats(game);
    return true;
  }

  if (!game.turnStartedAt) {
    return false;
  }

  const rating = await resolveQuickplayRating(game.currentTurnId);
  const thinkDeadline = game.turnStartedAt.getTime() + getBotThinkTimeMs({
    gameId: game.id,
    moveCount: game.state.moveCount,
    rating,
  });

  if (thinkDeadline > now().getTime()) {
    return false;
  }

  const move = chooseBotMove({
    state: game.state,
    rating,
    seed: `${game.id}:${game.state.moveCount}:${game.currentTurnId}`,
  });

  await applyRecordedMove(game, game.currentTurnId, move);
  return true;
}

async function syncQuickplayState(viewerId: string) {
  const activeGame = await findActiveGameForUser(viewerId);
  if (activeGame) {
    if (activeGame.mode !== "quickplay") {
      return buildQuickplayState();
    }

    if (await maybePlayBotTurn(activeGame)) {
      resolveDisconnectState(activeGame);
      await saveGame(requireDb(), activeGame);
    }

    const users = await getUserMap([activeGame.playerXId, activeGame.playerOId]);
    const aggregate = buildGameAggregate(activeGame, await loadMovesForGame(activeGame.id), users);
    return buildQuickplayState({ game: activeGame, aggregate });
  }

  const pending = await getPendingQuickplayForUser(viewerId);
  if (!pending) {
    return buildQuickplayState();
  }

  const viewerRating = await resolveQuickplayRating(viewerId);
  const candidates = await listQuickplayCandidates(viewerId, pending.presetId);

  let bestCandidate: PersistedGame | null = null;
  let bestGap = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const gap = Math.abs((await resolveQuickplayRating(candidate.creatorId)) - viewerRating);
    if (gap < bestGap || (gap === bestGap && (!bestCandidate || candidate.createdAt < bestCandidate.createdAt))) {
      bestGap = gap;
      bestCandidate = candidate;
    }
  }

  if (bestCandidate) {
    const host = bestCandidate.createdAt.getTime() <= pending.createdAt.getTime() ? bestCandidate : pending;
    const guest = host.id === pending.id ? bestCandidate : pending;
    activateQuickplayGame(host, host.creatorId, guest.creatorId);
    await saveGame(requireDb(), host);
    await deleteGameById(guest.id);
    const users = await getUserMap([host.playerXId, host.playerOId]);
    const aggregate = buildGameAggregate(host, await loadMovesForGame(host.id), users);
    return buildQuickplayState({ game: host, aggregate });
  }

  const botDelayMs = getQuickplayBotDelayMs(pending.id);
  if (pending.createdAt.getTime() + botDelayMs <= now().getTime()) {
    const bot = pickBotForRating(viewerRating);
    activateQuickplayGame(pending, viewerId, bot.id);
    await saveGame(requireDb(), pending);
    const users = await getUserMap([pending.playerXId, pending.playerOId]);
    const aggregate = buildGameAggregate(pending, await loadMovesForGame(pending.id), users);
    return buildQuickplayState({ game: pending, aggregate });
  }

  return buildQuickplayState({ game: pending });
}

async function loadMovesForGame(gameId: string) {
  const db = requireDb();
  const rows = await db.query.movesTable.findMany({
    where: eq(movesTable.gameId, gameId),
    orderBy: (table, { asc }) => [asc(table.moveNumber)],
  });
  return rows.map(rowToMove);
}

async function expireChallenges(at = now()) {
  const db = requireDb();
  const pendingRows = await db.query.challengesTable.findMany({
    where: eq(challengesTable.status, "pending"),
  });
  const expiredIds = pendingRows
    .filter((challenge) => challenge.expiresAt.getTime() <= at.getTime())
    .map((challenge) => challenge.id);

  if (!expiredIds.length) {
    return;
  }

  await db
    .update(challengesTable)
    .set({
      status: "expired",
      updatedAt: at,
    })
    .where(inArray(challengesTable.id, expiredIds));
}

async function listChallengesForUser(userId: string, direction: "incoming" | "outgoing") {
  await expireChallenges();
  const db = requireDb();
  const rows = await db.query.challengesTable.findMany({
    where: and(
      direction === "incoming" ? eq(challengesTable.toUserId, userId) : eq(challengesTable.fromUserId, userId),
      inArray(challengesTable.status, ["pending", "accepted"]),
    ),
    orderBy: (table, { desc: orderDesc }) => [orderDesc(table.createdAt)],
  });

  const challenges = rows.map(rowToChallenge);
  const users = await getUserMap(
    challenges.flatMap((challenge) => [challenge.fromUserId, challenge.toUserId]),
  );

  return challenges.map((challenge) => buildChallengeAggregate(challenge, users));
}

async function findActiveGameForUser(userId: string) {
  const db = requireDb();
  const row = await db.query.gamesTable.findFirst({
    where: and(
      eq(gamesTable.status, "active"),
      or(eq(gamesTable.playerXId, userId), eq(gamesTable.playerOId, userId), eq(gamesTable.creatorId, userId)),
    ),
    orderBy: (table, { desc: orderDesc }) => [orderDesc(table.updatedAt)],
  });

  return row ? rowToGame(row) : null;
}

async function assertNoLiveCommitments(userId: string, options?: { ignoreChallengeId?: string; ignoreQuickplayGameId?: string }) {
  if (await findActiveGameForUser(userId)) {
    throw new AppError("Finish your current game before starting another one.", 409);
  }

  const db = requireDb();
  const pending = await db.query.challengesTable.findFirst({
    where: and(
      eq(challengesTable.status, "pending"),
      or(eq(challengesTable.fromUserId, userId), eq(challengesTable.toUserId, userId)),
    ),
  });

  if (pending && pending.id !== options?.ignoreChallengeId) {
    throw new AppError("Resolve your current challenge before starting another one.", 409);
  }

  const quickplay = await getPendingQuickplayForUser(userId);
  if (quickplay && quickplay.id !== options?.ignoreQuickplayGameId) {
    throw new AppError("Finish finding your current game before starting another one.", 409);
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
    statsFinalized: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    finishedAt: null,
  };

  game.roomId = `game:${game.id}`;
  game.inviteUrl = `${appConfig.appUrl}/play/${game.id}`;
  return game;
}

async function saveGame(db: ReturnType<typeof requireDb>, game: PersistedGame) {
  await db
    .update(gamesTable)
    .set({
      roomId: game.roomId,
      inviteUrl: game.inviteUrl,
      mode: game.mode,
      status: game.status,
      rated: game.rated ? 1 : 0,
      presetId: game.presetId,
      creatorId: game.creatorId,
      playerXId: game.playerXId,
      playerOId: game.playerOId,
      starterId: game.starterId,
      currentTurnId: game.currentTurnId,
      winnerId: game.winnerId,
      challengeId: game.challengeId,
      disconnectPlayerId: game.disconnectPlayerId,
      disconnectExpiresAt: game.disconnectExpiresAt,
      playerXLastSeenAt: game.playerXLastSeenAt,
      playerOLastSeenAt: game.playerOLastSeenAt,
      initialMs: game.initialMs,
      incrementMs: game.incrementMs,
      playerXRemainingMs: game.playerXRemainingMs,
      playerORemainingMs: game.playerORemainingMs,
      turnStartedAt: game.turnStartedAt,
      currentStateJson: game.state,
      statsFinalized: game.statsFinalized ? 1 : 0,
      updatedAt: game.updatedAt,
      finishedAt: game.finishedAt,
    })
    .where(eq(gamesTable.id, game.id));
}

async function persistStats(game: PersistedGame) {
  if (game.statsFinalized) {
    return;
  }

  if (!game.playerXId || !game.playerOId) {
    return;
  }

  const playerXId = game.playerXId;
  const playerOId = game.playerOId;
  const db = requireDb();
  let alreadyFinalized = false;
  let statsApplied = false;

  await db.transaction(async (tx) => {
    const claimed = await tx
      .update(gamesTable)
      .set({
        statsFinalized: 1,
        updatedAt: now(),
      })
      .where(and(eq(gamesTable.id, game.id), eq(gamesTable.statsFinalized, 0)))
      .returning({ id: gamesTable.id });

    if (claimed.length === 0) {
      alreadyFinalized = true;
      return;
    }

    const rows = await tx
      .select()
      .from(profilesTable)
      .where(inArray(profilesTable.id, [playerXId, playerOId]));

    const playerX = rows.find((row) => row.id === playerXId) ?? null;
    const playerO = rows.find((row) => row.id === playerOId) ?? null;
    const updatedX = playerX ? { ...playerX } : null;
    const updatedO = playerO ? { ...playerO } : null;
    const isDraw = !game.winnerId;

    if (isDraw) {
      if (updatedX) {
        updatedX.draws += 1;
      }
      if (updatedO) {
        updatedO.draws += 1;
      }
    } else if (game.winnerId === playerXId) {
      if (updatedX) {
        updatedX.wins += 1;
      }
      if (updatedO) {
        updatedO.losses += 1;
      }
    } else if (game.winnerId === playerOId) {
      if (updatedO) {
        updatedO.wins += 1;
      }
      if (updatedX) {
        updatedX.losses += 1;
      }
    }

    if (game.mode === "quickplay" && game.rated) {
      const expectedScore = (rating: number, opponentRating: number) =>
        1 / (1 + 10 ** ((opponentRating - rating) / 400));

      const xRating = updatedX?.quickplayRating ?? getStaticRatingForUser(playerXId) ?? 1200;
      const oRating = updatedO?.quickplayRating ?? getStaticRatingForUser(playerOId) ?? 1200;
      const xScore = isDraw ? 0.5 : game.winnerId === playerXId ? 1 : 0;
      const oScore = 1 - xScore;
      const xDelta = Math.round(24 * (xScore - expectedScore(xRating, oRating)));
      const oDelta = Math.round(24 * (oScore - expectedScore(oRating, xRating)));

      if (updatedX) {
        updatedX.quickplayGamesPlayed += 1;
        updatedX.quickplayRating = Math.max(300, updatedX.quickplayRating + xDelta);
      }

      if (updatedO) {
        updatedO.quickplayGamesPlayed += 1;
        updatedO.quickplayRating = Math.max(300, updatedO.quickplayRating + oDelta);
      }
    }

    if (updatedX) {
      await tx.update(profilesTable).set({
        wins: updatedX.wins,
        losses: updatedX.losses,
        draws: updatedX.draws,
        quickplayRating: updatedX.quickplayRating,
        quickplayGamesPlayed: updatedX.quickplayGamesPlayed,
        updatedAt: now(),
      }).where(eq(profilesTable.id, updatedX.id));
    }

    if (updatedO) {
      await tx.update(profilesTable).set({
        wins: updatedO.wins,
        losses: updatedO.losses,
        draws: updatedO.draws,
        quickplayRating: updatedO.quickplayRating,
        quickplayGamesPlayed: updatedO.quickplayGamesPlayed,
        updatedAt: now(),
      }).where(eq(profilesTable.id, updatedO.id));
    }

    statsApplied = true;
  });

  game.statsFinalized = alreadyFinalized || statsApplied;
}

export async function ensureViewerUser(viewer: AppViewer) {
  const db = requireDb();
  const existing = await db.query.profilesTable.findFirst({
    where: eq(profilesTable.id, viewer.id),
  });

  if (existing) {
    if (
      existing.email !== viewer.email ||
      existing.avatarUrl !== viewer.avatarUrl ||
      existing.displayName !== existing.username
    ) {
      await db.update(profilesTable).set({
        email: viewer.email,
        avatarUrl: viewer.avatarUrl,
        displayName: existing.username,
        updatedAt: now(),
      }).where(eq(profilesTable.id, viewer.id));
    }

    return rowToProfile({ ...existing, displayName: existing.username });
  }

  const username = sanitizeUsername(viewer.username);
  const inserted = await db.insert(profilesTable).values({
    id: viewer.id,
    username,
    displayName: username,
    email: viewer.email,
    avatarUrl: viewer.avatarUrl,
    hasSeenForcedTargetHint: viewer.hasSeenForcedTargetHint ? 1 : 0,
  }).returning();

  return rowToProfile(inserted[0]);
}

export async function getDashboardData(viewer: AppViewer): Promise<HubData> {
  await ensureViewerUser(viewer);
  await expireChallenges();
  const quickplay = await syncQuickplayState(viewer.id);

  const activeGame = await findActiveGameForUser(viewer.id);
  let activeAggregate: GameAggregate | null = null;

  if (activeGame) {
    const beforeSignature = getRuntimeSignature(activeGame);
    if (resolveClockExpiry(activeGame)) {
      await persistStats(activeGame);
    }
    await maybePlayBotTurn(activeGame);
    resolveDisconnectState(activeGame);
    const changed = beforeSignature !== getRuntimeSignature(activeGame);
    if (changed) {
      activeGame.updatedAt = now();
      await saveGame(requireDb(), activeGame);
    }
    const users = await getUserMap([activeGame.playerXId, activeGame.playerOId]);
    activeAggregate = buildGameAggregate(activeGame, await loadMovesForGame(activeGame.id), users);
  }

  return {
    viewer,
    activeGame: activeAggregate,
    quickplay: activeGame?.mode === "quickplay"
      ? buildQuickplayState({
          game: activeGame,
          aggregate: activeAggregate,
        })
      : quickplay,
    incomingChallenges: await listChallengesForUser(viewer.id, "incoming"),
    outgoingChallenges: await listChallengesForUser(viewer.id, "outgoing"),
    presets: PRESETS,
  };
}

export async function getQuickplayStatus(viewer: AppViewer) {
  await ensureViewerUser(viewer);
  return syncQuickplayState(viewer.id);
}

export async function joinQuickplay(viewer: AppViewer, presetId: TimePresetId) {
  await ensureViewerUser(viewer);
  await expireChallenges();

  const activeGame = await findActiveGameForUser(viewer.id);
  if (activeGame) {
    if (activeGame.mode !== "quickplay") {
      throw new AppError("Finish your current game before starting another one.", 409);
    }

    const users = await getUserMap([activeGame.playerXId, activeGame.playerOId]);
    const aggregate = buildGameAggregate(activeGame, await loadMovesForGame(activeGame.id), users);
    return buildQuickplayState({ game: activeGame, aggregate });
  }

  const existingPending = await getPendingQuickplayForUser(viewer.id);
  if (existingPending && existingPending.presetId !== presetId) {
    await deleteGameById(existingPending.id);
  }

  await assertNoLiveCommitments(viewer.id, { ignoreQuickplayGameId: existingPending?.id });

  const refreshedPending = await getPendingQuickplayForUser(viewer.id);
  if (refreshedPending) {
    return syncQuickplayState(viewer.id);
  }

  const candidates = await listQuickplayCandidates(viewer.id, presetId);
  if (candidates[0]) {
    activateQuickplayGame(candidates[0], candidates[0].creatorId, viewer.id);
    await saveGame(requireDb(), candidates[0]);
    const users = await getUserMap([candidates[0].playerXId, candidates[0].playerOId]);
    const aggregate = buildGameAggregate(candidates[0], await loadMovesForGame(candidates[0].id), users);
    return buildQuickplayState({ game: candidates[0], aggregate });
  }

  const ticket = createPendingQuickplayGame(viewer.id, presetId);
  await insertGame(requireDb(), ticket);
  return buildQuickplayState({ game: ticket });
}

export async function leaveQuickplay(viewer: AppViewer) {
  await ensureViewerUser(viewer);

  const ticket = await getPendingQuickplayForUser(viewer.id);
  if (ticket) {
    await deleteGameById(ticket.id);
  }

  return buildQuickplayState();
}

export async function createChallenge(viewer: AppViewer, opponentUsername: string, presetId: TimePresetId) {
  await ensureViewerUser(viewer);
  await expireChallenges();
  await assertNoLiveCommitments(viewer.id);

  const db = requireDb();
  const normalized = sanitizeUsername(opponentUsername);
  const opponent = await db.query.profilesTable.findFirst({
    where: eq(profilesTable.username, normalized),
  });

  if (!opponent) {
    throw new AppError("That username does not exist.", 404);
  }

  if (opponent.id === viewer.id) {
    throw new AppError("You cannot challenge yourself.", 409);
  }

  await assertNoLiveCommitments(opponent.id);

  const challenge = {
    id: randomId("challenge"),
    status: "pending" as const,
    fromUserId: viewer.id,
    toUserId: opponent.id,
    presetId: getPresetById(presetId).id,
    gameId: null,
    expiresAt: new Date(now().getTime() + appConfig.challengeExpiryMs),
    createdAt: now(),
    updatedAt: now(),
  };

  const inserted = await db.insert(challengesTable).values(challenge).returning();
  const users = await getUserMap([viewer.id, opponent.id]);
  return buildChallengeAggregate(rowToChallenge(inserted[0]), users);
}

export async function acceptChallenge(viewer: AppViewer, challengeId: string) {
  await ensureViewerUser(viewer);
  await expireChallenges();

  const db = requireDb();
  const challengeRow = await db.query.challengesTable.findFirst({
    where: eq(challengesTable.id, challengeId),
  });
  if (!challengeRow) {
    throw new AppError("Challenge not found.", 404);
  }

  const challenge = rowToChallenge(challengeRow);
  if (challenge.toUserId !== viewer.id) {
    throw new AppError("This challenge does not belong to you.", 403);
  }
  if (challenge.status !== "pending") {
    throw new AppError("This challenge is no longer available.", 409);
  }
  if (challenge.expiresAt.getTime() <= now().getTime()) {
    await db.update(challengesTable).set({
      status: "expired",
      updatedAt: now(),
    }).where(eq(challengesTable.id, challenge.id));
    throw new AppError("This challenge is no longer available.", 409);
  }

  await assertNoLiveCommitments(viewer.id, { ignoreChallengeId: challenge.id });
  await assertNoLiveCommitments(challenge.fromUserId, { ignoreChallengeId: challenge.id });

  const game = createFreshGame({
    mode: "challenge",
    presetId: challenge.presetId,
    creatorId: challenge.fromUserId,
    playerXId: challenge.fromUserId,
    playerOId: viewer.id,
    rated: false,
    challengeId: challenge.id,
  });

  await db.transaction(async (tx) => {
    await tx.insert(gamesTable).values({
      id: game.id,
      roomId: game.roomId,
      inviteUrl: game.inviteUrl,
      mode: game.mode,
      status: game.status,
      rated: game.rated ? 1 : 0,
      presetId: game.presetId,
      creatorId: game.creatorId,
      playerXId: game.playerXId,
      playerOId: game.playerOId,
      starterId: game.starterId,
      currentTurnId: game.currentTurnId,
      winnerId: game.winnerId,
      challengeId: game.challengeId,
      disconnectPlayerId: game.disconnectPlayerId,
      disconnectExpiresAt: game.disconnectExpiresAt,
      playerXLastSeenAt: game.playerXLastSeenAt,
      playerOLastSeenAt: game.playerOLastSeenAt,
      initialMs: game.initialMs,
      incrementMs: game.incrementMs,
      playerXRemainingMs: game.playerXRemainingMs,
      playerORemainingMs: game.playerORemainingMs,
      turnStartedAt: game.turnStartedAt,
      currentStateJson: game.state,
      statsFinalized: game.statsFinalized ? 1 : 0,
      createdAt: game.createdAt,
      updatedAt: game.updatedAt,
      finishedAt: game.finishedAt,
    });

    await tx.update(challengesTable).set({
      status: "accepted",
      gameId: game.id,
      updatedAt: now(),
    }).where(eq(challengesTable.id, challenge.id));
  });

  const users = await getUserMap([game.playerXId, game.playerOId]);
  return {
    challenge: buildChallengeAggregate({
      ...challenge,
      status: "accepted",
      gameId: game.id,
      updatedAt: now(),
    }, users),
    game: buildGameAggregate(game, [], users),
  };
}

export async function declineChallenge(viewer: AppViewer, challengeId: string) {
  await ensureViewerUser(viewer);
  await expireChallenges();

  const db = requireDb();
  const row = await db.query.challengesTable.findFirst({
    where: eq(challengesTable.id, challengeId),
  });

  if (!row) {
    throw new AppError("Challenge not found.", 404);
  }

  const challenge = rowToChallenge(row);
  if (![challenge.fromUserId, challenge.toUserId].includes(viewer.id)) {
    throw new AppError("This challenge does not belong to you.", 403);
  }
  if (challenge.status !== "pending") {
    throw new AppError("This challenge has already been resolved.", 409);
  }

  const updatedAt = now();
  await db.update(challengesTable).set({
    status: "declined",
    updatedAt,
  }).where(eq(challengesTable.id, challenge.id));

  const users = await getUserMap([challenge.fromUserId, challenge.toUserId]);
  return buildChallengeAggregate({ ...challenge, status: "declined", updatedAt }, users);
}

export async function getGameAggregate(viewer: AppViewer, gameId: string) {
  await ensureViewerUser(viewer);
  const game = await loadGameById(gameId);
  if (!game) {
    throw new AppError("Game not found.", 404);
  }

  if (![game.playerXId, game.playerOId, game.creatorId].includes(viewer.id)) {
    throw new AppError("This game does not belong to your account.", 403);
  }

  const beforeSignature = getRuntimeSignature(game);
  if (resolveClockExpiry(game)) {
    await persistStats(game);
  }
  await maybePlayBotTurn(game);
  resolveDisconnectState(game);
  const changed = beforeSignature !== getRuntimeSignature(game);
  if (changed) {
    game.updatedAt = now();
    await saveGame(requireDb(), game);
  }

  const users = await getUserMap([game.playerXId, game.playerOId]);
  return buildGameAggregate(game, await loadMovesForGame(game.id), users);
}

export async function playMove(viewer: AppViewer, gameId: string, move: D3TMove) {
  await ensureViewerUser(viewer);
  const game = await loadGameById(gameId);

  if (!game) {
    throw new AppError("Game not found.", 404);
  }
  if (game.status !== "active") {
    throw new AppError("This game is not accepting moves.", 409);
  }
  if (resolveClockExpiry(game)) {
    await saveGame(requireDb(), game);
    await persistStats(game);
    throw new AppError("Your clock has already expired.", 409);
  }
  if (game.currentTurnId !== viewer.id) {
    throw new AppError("It is not your turn.", 409);
  }
  await applyRecordedMove(game, viewer.id, move);

  const users = await getUserMap([game.playerXId, game.playerOId]);
  return buildGameAggregate(game, await loadMovesForGame(game.id), users);
}

export async function resignGame(viewer: AppViewer, gameId: string) {
  const game = await loadGameById(gameId);
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

  await saveGame(requireDb(), game);
  await persistStats(game);
  const users = await getUserMap([game.playerXId, game.playerOId]);
  return buildGameAggregate(game, await loadMovesForGame(game.id), users);
}

export async function touchPresence(viewer: AppViewer, gameId: string) {
  const game = await loadGameById(gameId);
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
  await saveGame(requireDb(), game);

  const users = await getUserMap([game.playerXId, game.playerOId]);
  return buildGameAggregate(game, await loadMovesForGame(game.id), users);
}

export async function claimForfeit(viewer: AppViewer, gameId: string) {
  const game = await loadGameById(gameId);
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

  await saveGame(requireDb(), game);
  await persistStats(game);
  const users = await getUserMap([game.playerXId, game.playerOId]);
  return buildGameAggregate(game, await loadMovesForGame(game.id), users);
}

export async function rematchGame(viewer: AppViewer, gameId: string) {
  const game = await loadGameById(gameId);
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

  await requireDb().insert(gamesTable).values({
    id: rematch.id,
    roomId: rematch.roomId,
    inviteUrl: rematch.inviteUrl,
    mode: rematch.mode,
    status: rematch.status,
    rated: rematch.rated ? 1 : 0,
    presetId: rematch.presetId,
    creatorId: rematch.creatorId,
    playerXId: rematch.playerXId,
    playerOId: rematch.playerOId,
    starterId: rematch.starterId,
    currentTurnId: rematch.currentTurnId,
    winnerId: rematch.winnerId,
    challengeId: rematch.challengeId,
    disconnectPlayerId: rematch.disconnectPlayerId,
    disconnectExpiresAt: rematch.disconnectExpiresAt,
    playerXLastSeenAt: rematch.playerXLastSeenAt,
    playerOLastSeenAt: rematch.playerOLastSeenAt,
    initialMs: rematch.initialMs,
    incrementMs: rematch.incrementMs,
    playerXRemainingMs: rematch.playerXRemainingMs,
    playerORemainingMs: rematch.playerORemainingMs,
    turnStartedAt: rematch.turnStartedAt,
    currentStateJson: rematch.state,
    statsFinalized: rematch.statsFinalized ? 1 : 0,
    createdAt: rematch.createdAt,
    updatedAt: rematch.updatedAt,
    finishedAt: rematch.finishedAt,
  });

  const users = await getUserMap([rematch.playerXId, rematch.playerOId]);
  return buildGameAggregate(rematch, [], users);
}

export async function getPendingChallenges(viewer: AppViewer) {
  return {
    incomingChallenges: await listChallengesForUser(viewer.id, "incoming"),
    outgoingChallenges: await listChallengesForUser(viewer.id, "outgoing"),
  };
}

export async function markForcedTargetHintSeen(viewer: AppViewer) {
  await requireDb()
    .update(profilesTable)
    .set({
      hasSeenForcedTargetHint: 1,
      updatedAt: now(),
    })
    .where(eq(profilesTable.id, viewer.id));
}

export function getPresetOptions() {
  return PRESETS;
}
