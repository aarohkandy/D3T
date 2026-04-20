import assert from 'node:assert/strict';
import { test } from 'vitest';

import { applyMove, createInitialGameState, generateLegalMoves, getForcedBoard, oppositeMark, recomputeGameState, resetGameState, scoreTopBoard, scoreWinner, validateMove } from '../../lib/d3t/index.ts';

import type { D3TMark } from '../../lib/d3t';

function setLeafWinner(
  state: ReturnType<typeof createInitialGameState>,
  t1: number,
  t2: number,
  winner: D3TMark,
): void {
  const middle = state.board.boards[t1 - 1];
  const leaf = middle.boards[t2 - 1];
  leaf.cells = [winner, winner, winner, null, null, null, null, null, null];
}

function setLeafDraw(state: ReturnType<typeof createInitialGameState>, t1: number, t2: number): void {
  const middle = state.board.boards[t1 - 1];
  const leaf = middle.boards[t2 - 1];
  leaf.cells = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'];
}

function setMiddleWinner(
  state: ReturnType<typeof createInitialGameState>,
  t1: number,
  winner: D3TMark,
): void {
  setLeafWinner(state, t1, 1, winner);
  setLeafWinner(state, t1, 2, winner);
  setLeafWinner(state, t1, 3, winner);
}

function setMiddleDraw(state: ReturnType<typeof createInitialGameState>, t1: number): void {
  for (const t2 of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    setLeafDraw(state, t1, t2);
  }
}

test('creates an empty game state', () => {
  const state = createInitialGameState('X');
  assert.equal(state.turn, 'X');
  assert.equal(state.currentPlayer, 'X');
  assert.equal(state.status, 'active');
  assert.equal(state.outcome, 'active');
  assert.equal(state.board.status, 'open');
  assert.equal(state.moveCount, 0);
  assert.equal(state.nextForced, null);
  assert.equal(state.nextTarget, null);
  assert.equal(state.topBoardOwners.length, 9);
  assert.equal(state.middleBoardSummaries.length, 9);
  assert.equal(state.middleBoardSummaries[0].cellOwners.length, 9);
  assert.equal(generateLegalMoves(state).length, 729);
});

test('routes the next move from (t1,t2,t3) to (t2,t3,_)', () => {
  const first = createInitialGameState('X');
  const afterFirst = applyMove(first, { t1: 4, t2: 5, t3: 6 }).state;

  assert.deepEqual(afterFirst.nextForced, { t1: 5, t2: 6 });
  assert.deepEqual(afterFirst.nextTarget, { t1: 5, t2: 6 });
  assert.equal(afterFirst.turn, 'O');
  assert.equal(afterFirst.currentPlayer, 'O');
  assert.equal(validateMove(afterFirst, { t1: 5, t2: 6, t3: 1 }).ok, true);
  assert.equal(validateMove(afterFirst, { t1: 4, t2: 5, t3: 1 }).ok, false);
});

test('falls back to anywhere when the forced destination is closed', () => {
  const state = createInitialGameState('X');
  state.nextForced = { t1: 5, t2: 6 };
  state.board.boards[4].boards[5].status = 'draw';

  const legalMoves = generateLegalMoves(state);
  assert.equal(getForcedBoard(state), null);
  assert.equal(legalMoves.length, 720);
  assert.equal(validateMove(state, { t1: 1, t2: 1, t3: 1 }).ok, true);
});

test('rejects illegal moves cleanly', () => {
  const state = createInitialGameState('X');
  const afterFirst = applyMove(state, { t1: 2, t2: 2, t3: 2 }).state;

  assert.deepEqual(validateMove(afterFirst, { t1: 1, t2: 1, t3: 1 }), {
    ok: false,
    reason: 'forced-board',
  });

  const occupied = createInitialGameState('X');
  occupied.nextForced = null;
  occupied.board.boards[1].boards[1].cells[0] = 'X';

  assert.deepEqual(validateMove(occupied, { t1: 2, t2: 2, t3: 1 }), {
    ok: false,
    reason: 'cell-occupied',
  });
});

test('wins a leaf board and propagates the claim upward', () => {
  const state = createInitialGameState('X');
  const leaf = state.board.boards[0].boards[0];
  leaf.cells = ['X', 'X', null, null, 'O', null, null, null, 'O'];
  state.nextForced = null;

  const next = applyMove(state, { t1: 1, t2: 1, t3: 3 }).state;

  assert.equal(next.board.boards[0].boards[0].status, 'won');
  assert.equal(next.board.boards[0].boards[0].winner, 'X');
  assert.equal(next.board.boards[0].status, 'open');
  assert.deepEqual(next.nextForced, { t1: 1, t2: 3 });
});

test('wins the top board immediately when a line is completed', () => {
  const state = createInitialGameState('X');
  setMiddleWinner(state, 1, 'X');
  setMiddleWinner(state, 2, 'X');
  setMiddleWinner(state, 3, 'X');

  const next = recomputeGameState(state);

  assert.equal(next.status, 'finished');
  assert.equal(next.winner, 'X');
  assert.equal(next.board.status, 'won');
  assert.equal(next.board.winner, 'X');
});

test('scores a full top board by majority when there is no line', () => {
  const state = createInitialGameState('X');
  const winners: Array<[number, D3TMark]> = [
    [1, 'X'],
    [3, 'X'],
    [4, 'X'],
    [6, 'X'],
    [8, 'X'],
    [2, 'O'],
    [5, 'O'],
    [7, 'O'],
    [9, 'O'],
  ];

  for (const [t1, winner] of winners) {
    setMiddleWinner(state, t1, winner);
  }

  const finished = recomputeGameState(state);

  assert.equal(finished.status, 'finished');
  assert.equal(finished.board.status, 'draw');
  assert.deepEqual(scoreTopBoard(finished.board), { X: 5, O: 4 });
  assert.equal(scoreWinner(finished.score), 'X');
});

test('scores a tied full top board as a draw', () => {
  const state = createInitialGameState('X');
  const winners: Array<[number, D3TMark]> = [
    [1, 'X'],
    [3, 'X'],
    [6, 'X'],
    [8, 'X'],
    [2, 'O'],
    [4, 'O'],
    [7, 'O'],
    [9, 'O'],
  ];

  for (const [t1, winner] of winners) {
    setMiddleWinner(state, t1, winner);
  }
  setMiddleDraw(state, 5);

  const finished = recomputeGameState(state);

  assert.equal(finished.status, 'finished');
  assert.equal(finished.winner, null);
  assert.deepEqual(scoreTopBoard(finished.board), { X: 4, O: 4 });
  assert.equal(scoreWinner(finished.score), null);
});

test('resets for a rematch with a clean board and the next starter', () => {
  const state = createInitialGameState('X');
  const afterMove = applyMove(state, { t1: 4, t2: 5, t3: 6 }).state;
  const rematch = resetGameState(afterMove);

  assert.equal(rematch.turn, 'O');
  assert.equal(rematch.starter, 'O');
  assert.equal(rematch.status, 'active');
  assert.equal(rematch.moveCount, 0);
  assert.equal(rematch.nextForced, null);
  assert.equal(rematch.board.status, 'open');
  assert.equal(rematch.board.boards[0].boards[0].status, 'open');
});

test('exports a simple opposite mark helper', () => {
  assert.equal(oppositeMark('X'), 'O');
  assert.equal(oppositeMark('O'), 'X');
});
