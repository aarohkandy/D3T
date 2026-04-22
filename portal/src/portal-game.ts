import {
  applyMove,
  createInitialGameState,
  getLegalMoves,
  oppositeMark,
  resetGameState,
  validateMove,
  type D3TGameState,
  type D3TMark,
  type D3TMove,
  type D3TRecordedMove,
} from "../../src/lib/d3t";

const DEFAULT_INITIAL_MS = 3 * 60 * 1000;
const DEFAULT_INCREMENT_MS = 2 * 1000;

export type PortalResult =
  | { type: "board"; winner: D3TMark | null }
  | { type: "timeout"; winner: D3TMark; loser: D3TMark };

export type PortalGame = {
  state: D3TGameState;
  status: "active" | "finished";
  turn: D3TMark;
  winner: D3TMark | null;
  moveCount: number;
  timers: Record<D3TMark, number>;
  incrementMs: number;
  lastTickAt: number;
  history: D3TRecordedMove[];
  result: PortalResult | null;
  lastError: string | null;
};

function withDerivedFields(game: Omit<PortalGame, "status" | "turn" | "winner" | "moveCount">): PortalGame {
  return {
    ...game,
    status: game.result ? "finished" : game.state.status,
    turn: game.state.turn,
    winner: game.result?.winner ?? game.state.winner,
    moveCount: game.state.moveCount,
  };
}

export function createInitialPortalState(options: {
  now?: number;
  starter?: D3TMark;
  initialMs?: number;
  incrementMs?: number;
} = {}): PortalGame {
  const initialMs = options.initialMs ?? DEFAULT_INITIAL_MS;

  return withDerivedFields({
    state: createInitialGameState(options.starter ?? "X"),
    timers: { X: initialMs, O: initialMs },
    incrementMs: options.incrementMs ?? DEFAULT_INCREMENT_MS,
    lastTickAt: options.now ?? 0,
    history: [],
    result: null,
    lastError: null,
  });
}

export const createPortalGame = createInitialPortalState;

export function tickPortalTimers(game: PortalGame, deltaOrOptions: number | { deltaMs?: number; now?: number }): PortalGame {
  if (game.result || game.state.status !== "active") {
    return withDerivedFields({ ...game, lastTickAt: typeof deltaOrOptions === "object" && deltaOrOptions.now ? deltaOrOptions.now : game.lastTickAt });
  }

  const now = typeof deltaOrOptions === "object" && deltaOrOptions.now !== undefined
    ? deltaOrOptions.now
    : game.lastTickAt + (typeof deltaOrOptions === "number" ? deltaOrOptions : deltaOrOptions.deltaMs ?? 0);
  const elapsed = Math.max(0, now - game.lastTickAt);
  const player = game.state.turn;
  const remaining = Math.max(0, game.timers[player] - elapsed);
  const timers = { ...game.timers, [player]: remaining };

  if (remaining === 0) {
    return withDerivedFields({
      ...game,
      timers,
      lastTickAt: now,
      result: {
        type: "timeout",
        loser: player,
        winner: oppositeMark(player),
      },
    });
  }

  return withDerivedFields({
    ...game,
    timers,
    lastTickAt: now,
  });
}

export const advancePortalTimers = tickPortalTimers;

export function applyPortalMove(game: PortalGame, move: D3TMove, now = game.lastTickAt): PortalGame {
  const ticked = tickPortalTimers(game, { now });
  if (ticked.result) {
    return ticked;
  }

  const validation = validateMove(ticked.state, move);
  if (!validation.ok) {
    return withDerivedFields({
      ...ticked,
      lastError: validation.reason,
    });
  }

  const player = ticked.state.turn;
  const applied = applyMove(ticked.state, move);
  const timers = {
    ...ticked.timers,
    [player]: ticked.timers[player] + ticked.incrementMs,
  };

  return withDerivedFields({
    ...ticked,
    state: applied.state,
    timers,
    lastTickAt: now,
    history: [...ticked.history, applied.move],
    result: applied.state.status === "finished"
      ? {
          type: "board",
          winner: applied.state.winner,
        }
      : null,
    lastError: null,
  });
}

function isPortalGame(value: PortalGame | D3TGameState): value is PortalGame {
  return "timers" in value && "state" in value;
}

export function resetPortalState(game: PortalGame | D3TGameState, starter?: D3TMark): PortalGame {
  const state = isPortalGame(game) ? game.state : game;
  const nextStarter = starter ?? oppositeMark(state.starter);
  const lastTickAt = isPortalGame(game) ? game.lastTickAt : 0;
  const initialMs = isPortalGame(game)
    ? Math.max(game.timers.X, game.timers.O, DEFAULT_INITIAL_MS)
    : DEFAULT_INITIAL_MS;
  const incrementMs = isPortalGame(game) ? game.incrementMs : DEFAULT_INCREMENT_MS;

  return withDerivedFields({
    ...createInitialPortalState({
      now: lastTickAt,
      starter: nextStarter,
      initialMs,
      incrementMs,
    }),
    state: resetGameState(state, nextStarter),
  });
}

export const createPortalRematchState = resetPortalState;

export function isPortalMoveLegal(game: PortalGame, move: D3TMove): boolean {
  return !game.result && validateMove(game.state, move).ok;
}

export function generateLegalPortalMoves(game: PortalGame): D3TMove[] {
  return game.result ? [] : getLegalMoves(game.state);
}

export const getPortalLegalMoves = generateLegalPortalMoves;
