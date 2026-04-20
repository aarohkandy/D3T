"use client";

import { useState } from "react";

import type { D3TGameState } from "@/lib/d3t/engine";

import { GameBoard } from "@/components/game/game-board";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export type ReplayFrame = {
  moveNumber: number;
  label: string;
  state: D3TGameState;
};

export function HistoryPlayer({
  initialState,
  frames,
}: {
  initialState: D3TGameState;
  frames: ReplayFrame[];
}) {
  const [step, setStep] = useState(frames.length);
  const state = step === 0 ? initialState : frames[step - 1]?.state ?? initialState;

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <Card>
        <GameBoard
          state={state}
          disabled
        />
      </Card>

      <div className="space-y-6">
        <Card className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Replay controls</h2>
          <input
            type="range"
            min={0}
            max={frames.length}
            value={step}
            onChange={(event) => setStep(Number(event.target.value))}
            className="w-full accent-[color:var(--color-accent)]"
          />
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => setStep(0)}>
              Start
            </Button>
            <Button variant="secondary" onClick={() => setStep((value: number) => Math.max(0, value - 1))}>
              Back
            </Button>
            <Button onClick={() => setStep((value: number) => Math.min(frames.length, value + 1))}>
              Next
            </Button>
            <Button variant="secondary" onClick={() => setStep(frames.length)}>
              End
            </Button>
          </div>
          <div className="rounded-xl border border-[color:var(--color-line-soft)] bg-[color:var(--color-panel-soft)] p-4 text-sm leading-7 text-[color:var(--color-ink-soft)]">
            {step === 0 ? (
              <p>Initial state before any moves.</p>
            ) : (
              <p>{frames[step - 1]?.label}</p>
            )}
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Timeline</h2>
          <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
            {frames.map((frame) => (
              <button
                key={frame.moveNumber}
                type="button"
                onClick={() => setStep(frame.moveNumber)}
                className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${
                  step === frame.moveNumber
                    ? "border-[color:var(--color-accent)] bg-[rgba(132,185,79,0.12)] text-white"
                    : "border-[color:var(--color-line-soft)] bg-[color:var(--color-panel-soft)] text-[color:var(--color-ink-soft)] hover:bg-[#3b3734]"
                }`}
              >
                <p className="font-semibold">{frame.label}</p>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
