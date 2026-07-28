import assert from "node:assert/strict";
import { test } from "vitest";

import { chooseBotMove } from "../../lib/d3t/bot";
import { createInitialGameState, generateLegalMoves, recomputeGameState } from "../../lib/d3t";

test("bot chooses a legal move from the opening position", () => {
  const state = createInitialGameState("X");
  const move = chooseBotMove({
    state,
    rating: 1400,
    seed: "opening",
  });

  assert.equal(
    generateLegalMoves(state).some(
      (candidate) =>
        candidate.t1 === move.t1 && candidate.t2 === move.t2 && candidate.t3 === move.t3,
    ),
    true,
  );
});

test("bot takes an immediate winning leaf when it has one", () => {
  const raw = createInitialGameState("X");
  raw.nextForced = null;
  raw.board.boards[0].boards[0].cells = ["X", "X", null, null, "O", null, null, null, "O"];
  raw.board.boards[0].boards[1].cells = ["X", "X", "X", null, null, null, null, null, null];
  raw.board.boards[0].boards[2].cells = ["X", "X", "X", null, null, null, null, null, null];
  const state = recomputeGameState(raw);

  const move = chooseBotMove({
    state,
    rating: 1800,
    seed: "finish-now",
  });

  assert.deepEqual(move, { t1: 1, t2: 1, t3: 3 });
});

test("bot takes an immediate winning leaf even at low rating", () => {
  const raw = createInitialGameState("X");
  raw.nextForced = null;
  raw.board.boards[0].boards[0].cells = ["X", "X", null, null, "O", null, null, null, "O"];
  const state = recomputeGameState(raw);

  const move = chooseBotMove({
    state,
    rating: 900,
    seed: "finish-low-rating",
  });

  assert.deepEqual(move, { t1: 1, t2: 1, t3: 3 });
});

test("bot blocks an immediate winning leaf when it cannot win first", () => {
  const raw = createInitialGameState("X");
  raw.nextForced = { t1: 1, t2: 1 };
  raw.board.boards[0].boards[0].cells = ["O", "O", null, null, "X", null, null, null, null];
  const state = recomputeGameState(raw);

  const move = chooseBotMove({
    state,
    rating: 900,
    seed: "block-low-rating",
  });

  assert.deepEqual(move, { t1: 1, t2: 1, t3: 3 });
});

test("bot converts a forced-board win into a middle-board win", () => {
  const raw = createInitialGameState("X");
  raw.nextForced = { t1: 2, t2: 2 };
  raw.board.boards[1].boards[0].cells = ["X", "X", "X", null, null, null, null, null, null];
  raw.board.boards[1].boards[2].cells = ["X", "X", "X", null, null, null, null, null, null];
  raw.board.boards[1].boards[1].cells = ["X", "X", null, "O", null, null, null, null, null];
  const state = recomputeGameState(raw);

  const move = chooseBotMove({
    state,
    rating: 1800,
    seed: "must-block",
  });

  assert.deepEqual(move, { t1: 2, t2: 2, t3: 3 });
});
