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
import { chooseBotMove, getBotThinkTimeMs } from "@/lib/d3t/bot";
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
    .map((id) => [id, store.users.get(id) ?? getBuiltInBot(id) ?? null] as const)
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

function isQuickplayQueueGame(game: PersistedGame) {
  return game.mode === "quickplay" && game.status === "pending";
}

function isBotGame(game: PersistedGame) {
  return isAutomatedPlayerId(game.playerXId) || isAutomatedPlayerId(game.playerOId);
}

function resolveQuickplayRating(userId?: string | null) {
  if (!userId) {
    return 1200;
  }

  const builtIn = getStaticRatingForUser(userId);
  if (typeof builtIn === "number") {
    return builtIn;
  }

  return getMemoryStore().users.get(userId)?.quickplayRating ?? 1200;
}

function pickSeatOrder(gameId: string, firstPlayerId: string, secondPlayerId: string) {
  return createRandomStarter(() => Math.random()) === "X"
    ? ([firstPlayerId, secondPlayerId] as const)
    : ([secondPlayerId, firstPlayerId] as const);
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
  const [playerXId, playerOId] = pickSeatOrder(game.id, firstPlayerId, secondPlayerId);
  const starterMark = createRandomStarter() as PlayerMark;
  const starterId = starterMark === "X" ? playerXId : playerOId;

  game.status = "active";
  game.rated = true;
  game.playerXId = playerXId;
  game.playerOId = playerOId;
  game.starterId = starterId;
  game.currentTurnId = starterId;
  game.winnerId = null;
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
}

function getPendingQuickplayForUser(userId: string) {
  const store = getMemoryStore();

  return (
    Array.from(store.games.values())
      .filter(
        (game) =>
          isQuickplayQueueGame(game) &&
          [game.playerXId, game.playerOId, game.creatorId].includes(userId),
      )
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())[0] ?? null
  );
}

function listQuickplayCandidates(userId: string, presetId: TimePresetId) {
  return Array.from(getMemoryStore().games.values())
    .filter((game) => isQuickplayQueueGame(game))
    .filter((game) => game.presetId === presetId)
    .filter((game) => ![game.playerXId, game.playerOId, game.creatorId].includes(userId))
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
}

function getBotThinkDeadline(game: PersistedGame) {
  if (!game.turnStartedAt || !game.currentTurnId) {
    return null;
  }

  const rating = resolveQuickplayRating(game.currentTurnId);
  return (
    game.turnStartedAt.getTime() +
    getBotThinkTimeMs({
      gameId: game.id,
      moveCount: game.state.moveCount,
      rating,
    })
  );
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

  const xMissing =
    !game.playerXLastSeenAt ||
    at.getTime() - game.playerXLastSeenAt.getTime() >= appConfig.disconnectGraceMs;
  const oMissing =
    !game.playerOLastSeenAt ||
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
  const playerX = store.users.get(game.playerXId) ?? getBuiltInBot(game.playerXId);
  const playerO = store.users.get(game.playerOId) ?? getBuiltInBot(game.playerOId);

  if (!playerX && !playerO) {
    return;
  }

  const isDraw = !game.winnerId;

  if (isDraw) {
    if (playerX && !isAutomatedPlayerId(playerX.id)) {
      playerX.draws += 1;
    }
    if (playerO && !isAutomatedPlayerId(playerO.id)) {
      playerO.draws += 1;
    }
  } else if (game.winnerId === game.playerXId) {
    if (playerX && !isAutomatedPlayerId(playerX.id)) {
      playerX.wins += 1;
    }
    if (playerO && !isAutomatedPlayerId(playerO.id)) {
      playerO.losses += 1;
    }
  } else if (game.winnerId === game.playerOId) {
    if (playerO && !isAutomatedPlayerId(playerO.id)) {
      playerO.wins += 1;
    }
    if (playerX && !isAutomatedPlayerId(playerX.id)) {
      playerX.losses += 1;
    }
  }

  if (game.mode !== "quickplay" || !game.rated) {
    return;
  }

  const expectedScore = (rating: number, opponentRating: number) =>
    1 / (1 + 10 ** ((opponentRating - rating) / 400));

  const xRating = resolveQuickplayRating(game.playerXId);
  const oRating = resolveQuickplayRating(game.playerOId);
  const xScore = isDraw ? 0.5 : game.winnerId === game.playerXId ? 1 : 0;
  const oScore = 1 - xScore;
  const xExpected = expectedScore(xRating, oRating);
  const oExpected = expectedScore(oRating, xRating);
  const kFactor = 24;
  const xDelta = Math.round(kFactor * (xScore - xExpected));
  const oDelta = Math.round(kFactor * (oScore - oExpected));

  if (playerX && !isAutomatedPlayerId(playerX.id)) {
    playerX.quickplayGamesPlayed += 1;
    playerX.quickplayRating = Math.max(300, playerX.quickplayRating + xDelta);
  }

  if (playerO && !isAutomatedPlayerId(playerO.id)) {
    playerO.quickplayGamesPlayed += 1;
    playerO.quickplayRating = Math.max(300, playerO.quickplayRating + oDelta);
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
    playerX: game.playerXId ? (users.get(game.playerXId) ?? null) : null,
    playerO: game.playerOId ? (users.get(game.playerOId) ?? null) : null,
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
      game: params.aggregate ?? buildGameAggregate(params.game),
    };
  }

  return {
    status: "searching",
    preset: getPresetSummary(params.game.presetId),
    queuedAt: params.game.createdAt.toISOString(),
    game: null,
  };
}

function applyRecordedMove(game: PersistedGame, playerId: string, move: D3TMove) {
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

  const store = getMemoryStore();
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
    moveNumber: (store.moves.get(game.id)?.length ?? 0) + 1,
    playerId,
    move,
    resultingState: nextState,
    createdAt: updatedAt,
  };

  const currentMoves = store.moves.get(game.id) ?? [];
  store.moves.set(game.id, [...currentMoves, recordedMove]);

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
    finalizeStats(game);
  }

  return recordedMove;
}

function maybePlayBotTurn(game: PersistedGame) {
  if (game.status !== "active" || !game.currentTurnId || !isAutomatedPlayerId(game.currentTurnId)) {
    return false;
  }

  if (resolveClockExpiry(game)) {
    finalizeStats(game);
    return true;
  }

  const thinkDeadline = getBotThinkDeadline(game);
  if (!thinkDeadline || thinkDeadline > now().getTime()) {
    return false;
  }

  const rating = resolveQuickplayRating(game.currentTurnId);
  const move = chooseBotMove({
    state: game.state,
    rating,
    seed: `${game.id}:${game.state.moveCount}:${game.currentTurnId}`,
  });

  applyRecordedMove(game, game.currentTurnId, move);
  return true;
}

function syncQuickplayState(viewerId: string) {
  const activeGame = findActiveGameForUser(viewerId);
  if (activeGame) {
    if (activeGame.mode !== "quickplay") {
      return buildQuickplayState();
    }

    if (maybePlayBotTurn(activeGame)) {
      resolveDisconnectState(activeGame);
    }

    return buildQuickplayState({
      game: activeGame,
      aggregate: buildGameAggregate(activeGame),
    });
  }

  const pending = getPendingQuickplayForUser(viewerId);
  if (!pending) {
    return buildQuickplayState();
  }

  const viewerRating = resolveQuickplayRating(viewerId);
  const candidates = listQuickplayCandidates(viewerId, pending.presetId).sort((left, right) => {
    const leftGap = Math.abs(resolveQuickplayRating(left.creatorId) - viewerRating);
    const rightGap = Math.abs(resolveQuickplayRating(right.creatorId) - viewerRating);
    if (leftGap !== rightGap) {
      return leftGap - rightGap;
    }
    return left.createdAt.getTime() - right.createdAt.getTime();
  });

  if (candidates[0]) {
    const host =
      candidates[0].createdAt.getTime() <= pending.createdAt.getTime() ? candidates[0] : pending;
    const guest = host.id === pending.id ? candidates[0] : pending;
    activateQuickplayGame(
      host,
      host.creatorId,
      viewerId === host.creatorId ? guest.creatorId : viewerId,
    );
    getMemoryStore().games.delete(guest.id);
    return buildQuickplayState({
      game: host,
      aggregate: buildGameAggregate(host),
    });
  }

  const botDelayMs = getQuickplayBotDelayMs(pending.id);
  if (pending.createdAt.getTime() + botDelayMs <= now().getTime()) {
    const bot = pickBotForRating(viewerRating);
    activateQuickplayGame(pending, viewerId, bot.id);
    return buildQuickplayState({
      game: pending,
      aggregate: buildGameAggregate(pending),
    });
  }

  return buildQuickplayState({ game: pending });
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
    .filter((challenge) =>
      direction === "incoming" ? challenge.toUserId === userId : challenge.fromUserId === userId,
    )
    .filter((challenge) => ["pending", "accepted"].includes(challenge.status))
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}

function findActiveGameForUser(userId: string) {
  const store = getMemoryStore();

  return (
    Array.from(store.games.values())
      .filter((game) => [game.playerXId, game.playerOId, game.creatorId].includes(userId))
      .find((game) => game.status === "active") ?? null
  );
}

function assertNoLiveCommitments(
  userId: string,
  options?: { ignoreChallengeId?: string; ignoreQuickplayGameId?: string },
) {
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

  const quickplay = getPendingQuickplayForUser(userId);
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
  return (
    Array.from(getMemoryStore().users.values()).find((user) => user.username === normalized) ?? null
  );
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
    quickplayRating: 1200,
    quickplayGamesPlayed: 0,
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
  const quickplay = syncQuickplayState(viewer.id);
  const activeGame = findActiveGameForUser(viewer.id);
  if (activeGame) {
    if (resolveClockExpiry(activeGame)) {
      finalizeStats(activeGame);
    }
    maybePlayBotTurn(activeGame);
    resolveDisconnectState(activeGame);
  }
  return {
    viewer,
    activeGame: activeGame ? buildGameAggregate(activeGame) : null,
    quickplay:
      activeGame?.mode === "quickplay"
        ? buildQuickplayState({
            game: activeGame,
            aggregate: buildGameAggregate(activeGame),
          })
        : quickplay,
    incomingChallenges: listChallengesForUser(viewer.id, "incoming").map(buildChallengeAggregate),
    outgoingChallenges: listChallengesForUser(viewer.id, "outgoing").map(buildChallengeAggregate),
    presets: getPresetOptions(),
  };
}

export async function getQuickplayStatus(viewer: AppViewer) {
  if (isPostgresEnabled()) {
    return postgresStore.getQuickplayStatus(viewer);
  }

  await ensureViewerUser(viewer);
  return syncQuickplayState(viewer.id);
}

export async function joinQuickplay(viewer: AppViewer, presetId: TimePresetId) {
  if (isPostgresEnabled()) {
    return postgresStore.joinQuickplay(viewer, presetId);
  }

  await ensureViewerUser(viewer);
  expireChallenges();

  const activeGame = findActiveGameForUser(viewer.id);
  if (activeGame) {
    if (activeGame.mode !== "quickplay") {
      throw new AppError("Finish your current game before starting another one.", 409);
    }

    return buildQuickplayState({
      game: activeGame,
      aggregate: buildGameAggregate(activeGame),
    });
  }

  const existingPending = getPendingQuickplayForUser(viewer.id);
  if (existingPending && existingPending.presetId !== presetId) {
    getMemoryStore().games.delete(existingPending.id);
  }

  assertNoLiveCommitments(viewer.id, { ignoreQuickplayGameId: existingPending?.id });

  const refreshedPending = getPendingQuickplayForUser(viewer.id);
  if (refreshedPending) {
    return syncQuickplayState(viewer.id);
  }

  const candidates = listQuickplayCandidates(viewer.id, presetId);
  if (candidates[0]) {
    activateQuickplayGame(candidates[0], candidates[0].creatorId, viewer.id);
    return buildQuickplayState({
      game: candidates[0],
      aggregate: buildGameAggregate(candidates[0]),
    });
  }

  const ticket = createPendingQuickplayGame(viewer.id, presetId);
  getMemoryStore().games.set(ticket.id, ticket);
  return buildQuickplayState({ game: ticket });
}

export async function leaveQuickplay(viewer: AppViewer) {
  if (isPostgresEnabled()) {
    return postgresStore.leaveQuickplay(viewer);
  }

  await ensureViewerUser(viewer);

  for (const game of Array.from(getMemoryStore().games.values())) {
    if (
      isQuickplayQueueGame(game) &&
      [game.playerXId, game.playerOId, game.creatorId].includes(viewer.id)
    ) {
      getMemoryStore().games.delete(game.id);
    }
  }

  return buildQuickplayState();
}

export async function createChallenge(
  viewer: AppViewer,
  opponentUsername: string,
  presetId: TimePresetId,
) {
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

  maybePlayBotTurn(game);
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

  applyRecordedMove(game, viewer.id, move);

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
