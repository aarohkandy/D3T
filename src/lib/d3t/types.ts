export const D3T_INDICES = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export type D3TIndex = number;
export type D3TMark = 'X' | 'O';
export type D3TPlayer = D3TMark;
export type D3TBoardOwner = D3TMark | null;

export type D3TGameStatus = 'active' | 'finished';
export type D3TGameOutcome = 'active' | 'won' | 'draw';
export type D3TBoardStatus = 'open' | 'won' | 'draw';

export interface D3TMove extends Record<string, unknown> {
  t1: D3TIndex;
  t2: D3TIndex;
  t3: D3TIndex;
}

export interface D3TForcedBoard {
  t1: D3TIndex;
  t2: D3TIndex;
}

export interface D3TScore {
  X: number;
  O: number;
}

export interface D3TLeafBoardState {
  cells: D3TBoardOwner[];
  status: D3TBoardStatus;
  winner: D3TBoardOwner;
}

export interface D3TMiddleBoardState {
  boards: D3TLeafBoardState[];
  status: D3TBoardStatus;
  winner: D3TBoardOwner;
}

export interface D3TTopBoardState {
  boards: D3TMiddleBoardState[];
  status: D3TBoardStatus;
  winner: D3TBoardOwner;
}

export interface D3TGameState extends Record<string, unknown> {
  board: D3TTopBoardState;
  currentPlayer: D3TPlayer;
  turn: D3TMark;
  starter: D3TMark;
  nextTarget: D3TForcedBoard | null;
  nextForced: D3TForcedBoard | null;
  status: D3TGameStatus;
  outcome: D3TGameOutcome;
  winner: D3TBoardOwner;
  topBoardOwners: D3TBoardOwner[];
  middleBoardSummaries: D3TMiddleBoardSummary[];
  score: D3TScore;
  moveCount: number;
  lastMove: D3TRecordedMove | null;
}

export type D3TMoveError =
  | 'out-of-range'
  | 'game-finished'
  | 'wrong-turn'
  | 'forced-board'
  | 'board-closed'
  | 'cell-occupied';

export type D3TMoveValidation =
  | { ok: true }
  | { ok: false; reason: D3TMoveError };

export interface D3TRecordedMove extends D3TMove {
  player: D3TMark;
  moveNumber: number;
  resultingNextForced: D3TForcedBoard | null;
  resultingStatus: D3TGameStatus;
  resultingWinner: D3TBoardOwner;
  resultingScore: D3TScore;
}

export interface D3TApplyMoveResult {
  state: D3TGameState;
  move: D3TRecordedMove;
}

export interface D3TMiddleBoardSummary {
  index: D3TIndex;
  status: D3TBoardStatus;
  winner: D3TBoardOwner;
  cellOwners: D3TBoardOwner[];
}

export interface D3TReplay {
  initialState: D3TGameState;
  moves: D3TRecordedMove[];
  finalState: D3TGameState;
}
