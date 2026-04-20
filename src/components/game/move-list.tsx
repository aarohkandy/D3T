"use client";

import type { MoveRecord } from "@/lib/data/types";

export function MoveList({ moves }: { moves: MoveRecord[] }) {
  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-[color:var(--color-line-soft)] bg-[color:var(--color-panel)]">
      <div className="border-b border-[color:var(--color-line-soft)] px-4 py-3 text-sm font-semibold text-[color:var(--color-ink)]">
        Moves
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {moves.length === 0 ? (
          <p className="text-sm text-[color:var(--color-ink-muted)]">No moves yet.</p>
        ) : (
          <ol className="space-y-2">
            {moves.map((move) => (
              <li
                key={move.id}
                className="flex items-center justify-between rounded-xl border border-[color:var(--color-line-soft)] bg-[rgba(255,251,245,0.72)] px-3 py-2 text-sm"
              >
                <span className="font-mono text-[color:var(--color-ink-muted)]">{move.moveNumber}.</span>
                <span className="font-semibold text-[color:var(--color-ink)]">
                  {move.move.t1},{move.move.t2},{move.move.t3}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
