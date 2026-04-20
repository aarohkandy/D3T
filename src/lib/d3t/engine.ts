import { D3T_INDICES } from './types.ts';
import type {
  D3TApplyMoveResult,
  D3TBoardStatus,
  D3TForcedBoard,
  D3TGameState,
  D3TIndex,
  D3TLeafBoardState,
  D3TMark,
  D3TMove,
  D3TMoveValidation,
  D3TRecordedMove,
  D3TMiddleBoardSummary,
  D3TMiddleBoardState,
  D3TReplay,
  D3TScore,
  D3TTopBoardState,
} from './types.ts';

export type {
  D3TBoardOwner,
  D3TGameOutcome,
  D3TGameState,
  D3TGameStatus,
  D3TMark,
  D3TMove,
  D3TPlayer,
  D3TGameOutcome as GameOutcome,
} from './types.ts';

const BOARD_SIZE = 9;

export function isD3TIndex(value: number): value is D3TIndex {
  return Number.isInteger(value) && value >= 1 && value <= 9;
}

export function oppositeMark(mark: D3TMark): D3TMark {
  return mark === 'X' ? 'O' : 'X';
}

export function createEmptyLeafBoard(): D3TLeafBoardState {
  return {
    cells: Array.from({ length: BOARD_SIZE }, () => null),
    status: 'open',
    winner: null,
  };
}

export function createEmptyMiddleBoard(): D3TMiddleBoardState {
  return {
    boards: Array.from({ length: BOARD_SIZE }, () => createEmptyLeafBoard()),
    status: 'open',
    winner: null,
  };
}

export function createEmptyTopBoard(): D3TTopBoardState {
  return {
    boards: Array.from({ length: BOARD_SIZE }, () => createEmptyMiddleBoard()),
    status: 'open',
    winner: null,
  };
}

export function createInitialGameState(starter: D3TMark = 'X'): D3TGameState {
  const state: D3TGameState = {
    board: createEmptyTopBoard(),
    currentPlayer: starter,
    turn: starter,
    starter,
    nextTarget: null,
    nextForced: null,
    status: 'active',
    outcome: 'active',
    winner: null,
    topBoardOwners: Array.from({ length: BOARD_SIZE }, () => null),
    middleBoardSummaries: [],
    score: { X: 0, O: 0 },
    moveCount: 0,
    lastMove: null,
  };

  refreshDerivedGameStateFields(state);
  return state;
}

export function createRandomStarter(rng: () => number = Math.random): D3TMark {
  return rng() < 0.5 ? 'X' : 'O';
}

function toOffset(index: D3TIndex): number {
  return index - 1;
}

function cloneLeafBoard(board: D3TLeafBoardState): D3TLeafBoardState {
  return {
    cells: [...board.cells],
    status: board.status,
    winner: board.winner,
  };
}

function cloneMiddleBoard(board: D3TMiddleBoardState): D3TMiddleBoardState {
  return {
    boards: board.boards.map(cloneLeafBoard),
    status: board.status,
    winner: board.winner,
  };
}

function cloneTopBoard(board: D3TTopBoardState): D3TTopBoardState {
  return {
    boards: board.boards.map(cloneMiddleBoard),
    status: board.status,
    winner: board.winner,
  };
}

function deriveMiddleBoardSummary(board: D3TMiddleBoardState, index: D3TIndex): D3TMiddleBoardSummary {
  return {
    index,
    status: board.status,
    winner: board.winner,
    cellOwners: board.boards.map((child) => (child.status === 'won' ? child.winner : null)),
  };
}

function deriveTopBoardOwners(board: D3TTopBoardState): Array<D3TMark | null> {
  return board.boards.map((child) => (child.status === 'won' ? child.winner : null));
}

function refreshDerivedGameStateFields(state: D3TGameState): void {
  state.currentPlayer = state.turn;
  state.nextTarget = getForcedBoard(state);
  state.topBoardOwners = deriveTopBoardOwners(state.board);
  state.middleBoardSummaries = state.board.boards.map((middle, index) =>
    deriveMiddleBoardSummary(middle, D3T_INDICES[index]),
  );
}

export function cloneGameState(state: D3TGameState): D3TGameState {
  const cloned: D3TGameState = {
    board: cloneTopBoard(state.board),
    currentPlayer: state.currentPlayer,
    turn: state.turn,
    starter: state.starter,
    nextTarget: state.nextTarget ? { ...state.nextTarget } : null,
    nextForced: state.nextForced ? { ...state.nextForced } : null,
    status: state.status,
    outcome: state.outcome,
    winner: state.winner,
    topBoardOwners: [...state.topBoardOwners],
    middleBoardSummaries: state.middleBoardSummaries.map((summary) => ({
      index: summary.index,
      status: summary.status,
      winner: summary.winner,
      cellOwners: [...summary.cellOwners],
    })),
    score: { ...state.score },
    moveCount: state.moveCount,
    lastMove: state.lastMove
      ? {
          ...state.lastMove,
          resultingNextForced: state.lastMove.resultingNextForced
            ? { ...state.lastMove.resultingNextForced }
            : null,
          resultingScore: { ...state.lastMove.resultingScore },
      }
      : null,
  };

  refreshDerivedGameStateFields(cloned);
  return cloned;
}

function lineWinner(values: Array<D3TMark | null>): D3TMark | null {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ] as const;

  for (const [a, b, c] of lines) {
    const first = values[a];
    if (first !== null && first === values[b] && first === values[c]) {
      return first;
    }
  }

  return null;
}

function updateLeafBoard(board: D3TLeafBoardState): void {
  const winner = lineWinner(board.cells);
  if (winner) {
    board.status = 'won';
    board.winner = winner;
    return;
  }

  if (board.cells.every((cell) => cell !== null)) {
    board.status = 'draw';
    board.winner = null;
    return;
  }

  board.status = 'open';
  board.winner = null;
}

function updateMiddleBoard(board: D3TMiddleBoardState): void {
  const childOwners = board.boards.map((child) => (child.status === 'won' ? child.winner : null));
  const winner = lineWinner(childOwners);
  if (winner) {
    board.status = 'won';
    board.winner = winner;
    return;
  }

  if (board.boards.every((child) => child.status !== 'open')) {
    board.status = 'draw';
    board.winner = null;
    return;
  }

  board.status = 'open';
  board.winner = null;
}

function updateTopBoard(board: D3TTopBoardState): void {
  const childOwners = board.boards.map((child) => (child.status === 'won' ? child.winner : null));
  const winner = lineWinner(childOwners);
  if (winner) {
    board.status = 'won';
    board.winner = winner;
    return;
  }

  if (board.boards.every((child) => child.status !== 'open')) {
    board.status = 'draw';
    board.winner = null;
    return;
  }

  board.status = 'open';
  board.winner = null;
}

export function scoreTopBoard(board: D3TTopBoardState): D3TScore {
  const score: D3TScore = { X: 0, O: 0 };
  for (const child of board.boards) {
    if (child.status === 'won' && child.winner) {
      score[child.winner] += 1;
    }
  }
  return score;
}

export function scoreWinner(score: D3TScore): D3TMark | null {
  if (score.X > score.O) {
    return 'X';
  }
  if (score.O > score.X) {
    return 'O';
  }
  return null;
}

export function isLeafBoardPlayable(state: D3TGameState, t1: D3TIndex, t2: D3TIndex): boolean {
  const middle = state.board.boards[toOffset(t1)];
  return middle.status === 'open' && middle.boards[toOffset(t2)].status === 'open';
}

export function getLeafBoard(state: D3TGameState, t1: D3TIndex, t2: D3TIndex): D3TLeafBoardState {
  return state.board.boards[toOffset(t1)].boards[toOffset(t2)];
}

export function getForcedBoard(state: D3TGameState): D3TForcedBoard | null {
  const forced = state.nextForced;
  if (!forced) {
    return null;
  }

  return isLeafBoardPlayable(state, forced.t1, forced.t2) ? forced : null;
}

export function generateLegalMoves(state: D3TGameState): D3TMove[] {
  if (state.status !== 'active') {
    return [];
  }

  const forced = getForcedBoard(state);
  const moves: D3TMove[] = [];

  const pushMovesForBoard = (t1: D3TIndex, t2: D3TIndex): void => {
    const leaf = getLeafBoard(state, t1, t2);
    if (leaf.status !== 'open') {
      return;
    }

    for (const t3 of D3T_INDICES) {
      if (leaf.cells[toOffset(t3)] === null) {
        moves.push({ t1, t2, t3 });
      }
    }
  };

  if (forced) {
    pushMovesForBoard(forced.t1, forced.t2);
    return moves;
  }

  for (const t1 of D3T_INDICES) {
    const middle = state.board.boards[toOffset(t1)];
    if (middle.status !== 'open') {
      continue;
    }

    for (const t2 of D3T_INDICES) {
      pushMovesForBoard(t1, t2);
    }
  }

  return moves;
}

export const getLegalMoves = generateLegalMoves;

export function validateMove(state: D3TGameState, move: D3TMove): D3TMoveValidation {
  if (state.status !== 'active') {
    return { ok: false, reason: 'game-finished' };
  }

  if (!isD3TIndex(move.t1) || !isD3TIndex(move.t2) || !isD3TIndex(move.t3)) {
    return { ok: false, reason: 'out-of-range' };
  }

  if (move.t1 !== undefined && move.t2 !== undefined && move.t3 !== undefined) {
    // TypeScript already enforces indexes, but keep the guard for external callers.
  }

  const forced = getForcedBoard(state);
  if (forced && (move.t1 !== forced.t1 || move.t2 !== forced.t2)) {
    return { ok: false, reason: 'forced-board' };
  }

  if (!isLeafBoardPlayable(state, move.t1, move.t2)) {
    return { ok: false, reason: 'board-closed' };
  }

  const leaf = getLeafBoard(state, move.t1, move.t2);
  if (leaf.cells[toOffset(move.t3)] !== null) {
    return { ok: false, reason: 'cell-occupied' };
  }

  return { ok: true };
}

export function isLegalMove(state: D3TGameState, move: D3TMove): boolean {
  return validateMove(state, move).ok;
}

export function applyMove(state: D3TGameState, move: D3TMove): D3TApplyMoveResult {
  const validation = validateMove(state, move);
  if (!validation.ok) {
    throw new Error(`Illegal D3T move: ${validation.reason}`);
  }

  const nextState = cloneGameState(state);
  const player = nextState.turn;
  const leaf = getLeafBoard(nextState, move.t1, move.t2);
  leaf.cells[toOffset(move.t3)] = player;

  updateLeafBoard(leaf);
  updateMiddleBoard(nextState.board.boards[toOffset(move.t1)]);
  updateTopBoard(nextState.board);
  nextState.score = scoreTopBoard(nextState.board);

  if (nextState.board.status === 'won') {
    nextState.status = 'finished';
    nextState.outcome = 'won';
    nextState.winner = nextState.board.winner;
    nextState.nextForced = null;
  } else if (nextState.board.status === 'draw') {
    nextState.status = 'finished';
    nextState.winner = scoreWinner(nextState.score);
    nextState.outcome = nextState.winner ? 'won' : 'draw';
    nextState.nextForced = null;
  } else {
    const nextForced = { t1: move.t2, t2: move.t3 };
    nextState.nextForced = isLeafBoardPlayable(nextState, nextForced.t1, nextForced.t2) ? nextForced : null;
    nextState.status = 'active';
    nextState.outcome = 'active';
    nextState.winner = null;
  }

  nextState.moveCount += 1;
  nextState.turn = oppositeMark(player);
  refreshDerivedGameStateFields(nextState);
  nextState.lastMove = {
    ...move,
    player,
    moveNumber: nextState.moveCount,
    resultingNextForced: nextState.nextForced ? { ...nextState.nextForced } : null,
    resultingStatus: nextState.status,
    resultingWinner: nextState.winner,
    resultingScore: { ...nextState.score },
  };

  return { state: nextState, move: nextState.lastMove };
}

export function applyMoveToState(state: D3TGameState, move: D3TMove, player: D3TMark = state.turn): D3TGameState {
  if (player !== state.turn) {
    throw new Error(`Illegal D3T move: wrong-turn`);
  }
  return applyMove(state, move).state;
}

export function createRematchState(startingPlayer: D3TMark = 'X'): D3TGameState {
  return createInitialGameState(startingPlayer);
}

export function resetGameState(state: D3TGameState, starter: D3TMark = oppositeMark(state.starter)): D3TGameState {
  return createRematchState(starter);
}

export function getPathLabel(t1: D3TIndex, t2: D3TIndex, t3: D3TIndex): string {
  return `${t1},${t2},${t3}`;
}

export function summarizeBoardStatus(board: D3TTopBoardState): {
  status: D3TBoardStatus;
  winner: D3TMark | null;
  score: D3TScore;
} {
  return {
    status: board.status,
    winner: board.winner,
    score: scoreTopBoard(board),
  };
}

function cloneRecordedMove(move: D3TRecordedMove): D3TRecordedMove {
  return {
    ...move,
    resultingNextForced: move.resultingNextForced ? { ...move.resultingNextForced } : null,
    resultingScore: { ...move.resultingScore },
  };
}

export function serializeReplay(
  initialState: D3TGameState,
  moves: D3TRecordedMove[] = [],
  finalState: D3TGameState = initialState,
): D3TReplay {
  return {
    initialState: cloneGameState(initialState),
    moves: moves.map(cloneRecordedMove),
    finalState: cloneGameState(finalState),
  };
}

export function recomputeGameState(state: D3TGameState): D3TGameState {
  const next = cloneGameState(state);
  for (const middle of next.board.boards) {
    for (const leaf of middle.boards) {
      updateLeafBoard(leaf);
    }
    updateMiddleBoard(middle);
  }
  updateTopBoard(next.board);
  next.score = scoreTopBoard(next.board);
  if (next.board.status === 'won') {
    next.status = 'finished';
    next.outcome = 'won';
    next.winner = next.board.winner;
    next.nextForced = null;
  } else if (next.board.status === 'draw') {
    next.status = 'finished';
    next.winner = scoreWinner(next.score);
    next.outcome = next.winner ? 'won' : 'draw';
    next.nextForced = null;
  } else {
    next.status = 'active';
    next.outcome = 'active';
    next.winner = null;
    next.nextForced = getForcedBoard(next);
  }
  refreshDerivedGameStateFields(next);
  return next;
}
