import assert from "node:assert/strict";
import { describe, test } from "vitest";

import {
  applyPortalMove,
  createDuplicateEventGuard,
  createInitialPortalState,
  generateLegalPortalMoves,
  resetPortalState,
  tickPortalTimers,
} from "../../lib/portal/index.ts";

describe("portal contract", () => {
  test("creates an instant initial playable state", () => {
    const state = createInitialPortalState({
      starter: "X",
      initialMs: 60_000,
      incrementMs: 0,
    });
    const legalMoves = generateLegalPortalMoves(state);

    assert.equal(state.status, "active");
    assert.equal(state.turn, "X");
    assert.equal(state.winner, null);
    assert.equal(state.moveCount, 0);
    assert.ok(legalMoves.length > 0);
  });

  test("applies a legal move and advances turn state", () => {
    const state = createInitialPortalState({
      starter: "X",
      initialMs: 60_000,
      incrementMs: 0,
    });
    const [move] = generateLegalPortalMoves(state);
    const nextState = applyPortalMove(state, move);

    assert.notDeepEqual(nextState, state);
    assert.equal(nextState.turn, "O");
    assert.equal(nextState.moveCount, 1);
    assert.equal(nextState.status, "active");
  });

  test("resets for a rematch with a clean board and next starter", () => {
    const state = createInitialPortalState({
      starter: "X",
      initialMs: 60_000,
      incrementMs: 0,
    });
    const [move] = generateLegalPortalMoves(state);
    const afterMove = applyPortalMove(state, move);
    const rematch = resetPortalState(afterMove, "O");

    assert.equal(rematch.status, "active");
    assert.equal(rematch.turn, "O");
    assert.equal(rematch.moveCount, 0);
    assert.equal(rematch.winner, null);
    assert.ok(generateLegalPortalMoves(rematch).length > 0);
  });

  test("ticks the active clock without underflow", () => {
    const state = createInitialPortalState({
      starter: "X",
      initialMs: 5_000,
      incrementMs: 0,
    });

    const next = tickPortalTimers(state, 1_000);

    assert.equal(next.status, "active");
    assert.notDeepEqual(next, state);
    assert.equal(next.timers.X, 4_000);
    assert.equal(next.turn, "X");
  });

  test("guards the SDK adapter against duplicate events", () => {
    const seen: string[] = [];
    const guard = createDuplicateEventGuard<{ id: string }>({
      onEvent(event) {
        seen.push(event.id);
      },
    });

    guard({ id: "evt_1" });
    guard({ id: "evt_1" });
    guard({ id: "evt_2" });

    assert.deepEqual(seen, ["evt_1", "evt_2"]);
  });
});
