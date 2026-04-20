"use client";

import type { CSSProperties } from "react";

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

function ownerClass(owner: "X" | "O" | null) {
  if (owner === "X") {
    return "text-[color:var(--color-mark-x)]";
  }

  if (owner === "O") {
    return "text-[color:var(--color-mark-o)]";
  }

  return "text-transparent";
}

function leafFill(
  status: "open" | "won" | "draw",
  winner: "X" | "O" | null,
  isForced: boolean,
  isLegal: boolean,
) {
  if (isLegal) {
    return "bg-[rgba(78,61,49,0.14)]";
  }

  if (isForced) {
    return "bg-[rgba(78,61,49,0.06)]";
  }

  if (status === "draw") {
    return "bg-[rgba(78,61,49,0.04)]";
  }

  if (winner === "X") {
    return "bg-[rgba(198,83,77,0.08)]";
  }

  if (winner === "O") {
    return "bg-[rgba(69,119,204,0.08)]";
  }

  return "bg-transparent";
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
  const legalMoveSet = new Set((legalMoves ?? []).map((move) => `${move.t1}-${move.t2}-${move.t3}`));

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div
        className="grid aspect-square h-full max-h-full w-auto max-w-full overflow-hidden rounded-[22px] border border-[color:var(--color-line-strong)] bg-[rgba(255,251,245,0.82)] shadow-[0_24px_60px_rgba(88,66,46,0.12)]"
        style={{
          maxWidth: "980px",
          gridTemplateColumns: "repeat(27, minmax(0, 1fr))",
          gridTemplateRows: "repeat(27, minmax(0, 1fr))",
        }}
      >
        {Array.from({ length: 27 * 27 }).map((_, cellIndex) => {
          const row = Math.floor(cellIndex / 27);
          const col = cellIndex % 27;

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

          const middleBoard = state.board.boards[t1 - 1];
          const leafBoard = middleBoard?.boards[t2 - 1];
          const owner = leafBoard?.cells[t3 - 1] ?? null;
          const isForced = state.nextTarget?.t1 === t1 && state.nextTarget?.t2 === t2;
          const moveKey = `${t1}-${t2}-${t3}`;
          const isLegal = legalMoveSet.has(moveKey);
          const canClick = Boolean(onPlay) && isLegal && !disabled;

          const style: CSSProperties = {
            borderTopWidth: borderWidth(row, row % 9 === 0 ? 9 : 3),
            borderLeftWidth: borderWidth(col, col % 9 === 0 ? 9 : 3),
            borderRightWidth: col === 26 ? 5 : 0,
            borderBottomWidth: row === 26 ? 5 : 0,
          };

          return (
            <button
              key={moveKey}
              type="button"
              disabled={!canClick}
              onClick={() => onPlay?.({ t1, t2, t3 })}
              aria-label={`Play ${t1}, ${t2}, ${t3}`}
              className={cn(
                "grid min-h-0 min-w-0 place-items-center border-solid border-[rgba(71,56,43,0.2)] text-[clamp(8px,1.2vw,20px)] font-semibold leading-none transition",
                ownerClass(owner),
                leafFill(leafBoard?.status ?? "open", leafBoard?.winner ?? null, isForced, isLegal),
                canClick && "hover:bg-[rgba(78,61,49,0.18)]",
              )}
              style={style}
            >
              {owner ?? ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}
