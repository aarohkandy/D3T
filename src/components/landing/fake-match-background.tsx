"use client";

import { useEffect, useRef } from "react";

import { applyMoveToState, createInitialGameState, getLegalMoves, type D3TGameState } from "@/lib/d3t/engine";

const BOARD_CELLS = 27;
const BOARD_SIZE = 972;
const CELL_SIZE = BOARD_SIZE / BOARD_CELLS;

type VisualState = {
  state: D3TGameState;
  lastMoveKey: string | null;
};

function fromGridParts(row: number, col: number) {
  return row * 3 + col + 1;
}

const BACKGROUND_CELLS = Array.from({ length: BOARD_CELLS * BOARD_CELLS }, (_, cellIndex) => {
  const row = Math.floor(cellIndex / BOARD_CELLS);
  const col = cellIndex % BOARD_CELLS;
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

  return {
    x: col * CELL_SIZE,
    y: row * CELL_SIZE,
    t1: fromGridParts(top.row, top.col),
    t2: fromGridParts(middle.row, middle.col),
    t3: fromGridParts(leaf.row, leaf.col),
  };
});

function lineWidth(index: number, step: 3 | 9) {
  if (index === 0) {
    return step === 9 ? 6 : 3;
  }

  return index % step === 0 ? (step === 9 ? 6 : 3) : 1;
}

function nextStarter() {
  return Math.random() < 0.5 ? "X" : "O";
}

function drawBoard(ctx: CanvasRenderingContext2D, visual: VisualState) {
  ctx.clearRect(0, 0, BOARD_SIZE, BOARD_SIZE);

  ctx.fillStyle = "rgba(255, 249, 240, 0.12)";
  ctx.fillRect(0, 0, BOARD_SIZE, BOARD_SIZE);

  for (const { x, y, t1, t2, t3 } of BACKGROUND_CELLS) {
    const owner = visual.state.board.boards[t1 - 1]?.boards[t2 - 1]?.cells[t3 - 1] ?? null;
    const isLastMove = visual.lastMoveKey === `${t1}-${t2}-${t3}`;

    if (owner === "X" || owner === "O") {
      ctx.fillStyle = owner === "X"
        ? isLastMove
          ? "rgba(198, 83, 77, 0.22)"
          : "rgba(198, 83, 77, 0.1)"
        : isLastMove
          ? "rgba(69, 119, 204, 0.22)"
          : "rgba(69, 119, 204, 0.1)";
      ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

      ctx.fillStyle = owner === "X" ? "#c6534d" : "#4577cc";
      ctx.font = "600 18px Geist, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(owner, x + CELL_SIZE / 2, y + CELL_SIZE / 2 + 1);
    }
  }

  for (let row = 0; row <= BOARD_CELLS; row += 1) {
    const step = row % 9 === 0 ? 9 : 3;
    const width = row === BOARD_CELLS ? 6 : lineWidth(row, step as 3 | 9);
    ctx.strokeStyle = "rgba(96, 76, 55, 0.24)";
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(0, row * CELL_SIZE);
    ctx.lineTo(BOARD_SIZE, row * CELL_SIZE);
    ctx.stroke();
  }

  for (let col = 0; col <= BOARD_CELLS; col += 1) {
    const step = col % 9 === 0 ? 9 : 3;
    const width = col === BOARD_CELLS ? 6 : lineWidth(col, step as 3 | 9);
    ctx.strokeStyle = "rgba(96, 76, 55, 0.24)";
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(col * CELL_SIZE, 0);
    ctx.lineTo(col * CELL_SIZE, BOARD_SIZE);
    ctx.stroke();
  }
}

export function FakeMatchBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const visualRef = useRef<VisualState>({
    state: createInitialGameState("X"),
    lastMoveKey: null,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let stopped = false;

    const redraw = () => {
      drawBoard(ctx, visualRef.current);
    };

    redraw();

    const interval = window.setInterval(() => {
      if (stopped || document.hidden || media.matches) {
        return;
      }

      const current = visualRef.current;
      if (current.state.status !== "active") {
        visualRef.current = {
          state: createInitialGameState(nextStarter()),
          lastMoveKey: null,
        };
        redraw();
        return;
      }

      const legalMoves = getLegalMoves(current.state);
      if (!legalMoves.length) {
        visualRef.current = {
          state: createInitialGameState(nextStarter()),
          lastMoveKey: null,
        };
        redraw();
        return;
      }

      const move = legalMoves[Math.floor(Math.random() * legalMoves.length)];
      visualRef.current = {
        state: applyMoveToState(current.state, move),
        lastMoveKey: `${move.t1}-${move.t2}-${move.t3}`,
      };
      redraw();
    }, 520);

    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.7),_transparent_30%),linear-gradient(180deg,_rgba(255,248,238,0.48),_rgba(229,216,198,0.16))]" />
      <canvas
        ref={canvasRef}
        width={BOARD_SIZE}
        height={BOARD_SIZE}
        className="absolute left-1/2 top-1/2 h-[118vmax] w-[118vmax] -translate-x-1/2 -translate-y-1/2 opacity-70 blur-[1.5px] [mask-image:radial-gradient(circle,black_56%,transparent_94%)] [animation:board-drift_22s_ease-in-out_infinite_alternate]"
      />
    </div>
  );
}
