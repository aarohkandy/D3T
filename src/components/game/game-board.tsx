"use client";

import { useMemo, type CSSProperties } from "react";

import type { D3TGameState, D3TMove } from "@/lib/d3t/engine";
import { cn } from "@/lib/utils";

function fromGridParts(row: number, col: number) {
  return row * 3 + col + 1;
}

function borderWidth(index: number, step: 3 | 9) {
  if (index === 0) {
    return step === 9 ? 5 : 3;
  }

  return index % step === 0 ? (step === 9 ? 5 : 3) : 1;
}

type BoardCell = {
  moveKey: string;
  t1: number;
  t2: number;
  t3: number;
  style: CSSProperties;
};

const BOARD_DIMENSION = 27;
const BOARD_CELLS: BoardCell[] = Array.from(
  { length: BOARD_DIMENSION * BOARD_DIMENSION },
  (_, cellIndex) => {
    const row = Math.floor(cellIndex / BOARD_DIMENSION);
    const col = cellIndex % BOARD_DIMENSION;
    const top = {
      row: Math.floor(row / 9),
      col: Math.floor(col / 9),
    };
    const middle = {
      row: Math.floor((row % 9) / 3),
      col: Math.floor((col % 9) / 3),
    };
    const leaf = {
      row: row % 3,
      col: col % 3,
    };
    const t1 = fromGridParts(top.row, top.col);
    const t2 = fromGridParts(middle.row, middle.col);
    const t3 = fromGridParts(leaf.row, leaf.col);

    return {
      moveKey: `${t1}-${t2}-${t3}`,
      t1,
      t2,
      t3,
      style: {
        borderTopWidth: borderWidth(row, row % 9 === 0 ? 9 : 3),
        borderLeftWidth: borderWidth(col, col % 9 === 0 ? 9 : 3),
        borderRightWidth: col === BOARD_DIMENSION - 1 ? 5 : 0,
        borderBottomWidth: row === BOARD_DIMENSION - 1 ? 5 : 0,
      },
    };
  },
);

function MarkGlyph({
  owner,
  animate,
}: {
  owner: "X" | "O" | null;
  animate: boolean;
}) {
  if (!owner) {
    return null;
  }

  if (owner === "X") {
    return (
      <span className={cn("d3t-mark d3t-mark-x", animate && "d3t-mark-fresh")} aria-hidden="true">
        <span className="d3t-mark-x-stroke d3t-mark-x-stroke-a" />
        <span className="d3t-mark-x-stroke d3t-mark-x-stroke-b" />
      </span>
    );
  }

  return (
    <span className={cn("d3t-mark d3t-mark-o", animate && "d3t-mark-fresh")} aria-hidden="true">
      <svg viewBox="0 0 100 100" className="d3t-mark-o-svg">
        <circle className="d3t-mark-o-ring" cx="50" cy="50" r="37" />
      </svg>
    </span>
  );
}

function leafFill(
  status: "open" | "won" | "draw",
  winner: "X" | "O" | null,
  isForced: boolean,
  isLegal: boolean,
) {
  if (isLegal) {
    return "is-legal";
  }

  if (isForced) {
    return "is-forced";
  }

  if (status === "draw") {
    return "is-draw";
  }

  if (winner === "X") {
    return "is-x-won";
  }

  if (winner === "O") {
    return "is-o-won";
  }

  return null;
}

export function GameBoard({
  state,
  legalMoves,
  onPlay,
  disabled = false,
}: {
  state: D3TGameState;
  legalMoves?: D3TMove[];
  onPlay?: (move: D3TMove) => void;
  disabled?: boolean;
}) {
  const legalMoveSet = useMemo(
    () => new Set((legalMoves ?? []).map((move) => `${move.t1}-${move.t2}-${move.t3}`)),
    [legalMoves],
  );
  const animatedMoveKey = state.lastMove ? `${state.lastMove.t1}-${state.lastMove.t2}-${state.lastMove.t3}` : null;
  const animatedMoveToken = state.lastMove?.moveNumber ?? 0;

  return (
    <div className="d3t-board-wrap">
      <div
        className="d3t-board-grid grid aspect-square max-h-full overflow-hidden"
        style={{
          width: "min(100%, calc(100svh - 242px), 980px)",
          gridTemplateColumns: "repeat(27, minmax(0, 1fr))",
          gridTemplateRows: "repeat(27, minmax(0, 1fr))",
        }}
      >
        {BOARD_CELLS.map(({ moveKey, t1, t2, t3, style }) => {
          const middleBoard = state.board.boards[t1 - 1];
          const leafBoard = middleBoard?.boards[t2 - 1];
          const owner = leafBoard?.cells[t3 - 1] ?? null;
          const isForced = state.nextTarget?.t1 === t1 && state.nextTarget?.t2 === t2;
          const isLegal = legalMoveSet.has(moveKey);
          const canClick = Boolean(onPlay) && isLegal && !disabled;
          const isFresh = animatedMoveKey === moveKey;

          return (
            <button
              key={moveKey}
              type="button"
              disabled={!canClick}
              onClick={() => onPlay?.({ t1, t2, t3 })}
              aria-label={`Play ${t1}, ${t2}, ${t3}`}
              className={cn(
                "d3t-cell group relative grid min-h-0 min-w-0 place-items-center overflow-hidden border-solid transition duration-150 ease-out will-change-transform",
                leafFill(leafBoard?.status ?? "open", leafBoard?.winner ?? null, isForced, isLegal),
                owner === "X" && "has-x",
                owner === "O" && "has-o",
                canClick && "is-clickable cursor-pointer",
                isFresh && "is-fresh z-[2]",
              )}
              style={style}
            >
              <MarkGlyph key={isFresh ? `${moveKey}:${animatedMoveToken}` : moveKey} owner={owner} animate={isFresh} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
