"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const steps = [
  {
    title: "A move is always three numbers",
    copy:
      "You pick a path like (4, 5, 6). That means big board 4, middle board 5, tiny square 6.",
  },
  {
    title: "Your move forces the next player",
    copy:
      "If you played (4, 5, 6), the next move must start at (5, 6, _). D3T is all about setting traps with those forced paths.",
  },
  {
    title: "Win upward through the layers",
    copy:
      "Win a middle board to claim a square on the top board. Drawn middle boards become null and help no one. Top-board line wins instantly.",
  },
  {
    title: "If a forced target is dead, play anywhere",
    copy:
      "Once the forced board is already won or null, the next player gets a free move anywhere legal on the whole structure.",
  },
];

export function InteractiveTutorial() {
  const [step, setStep] = useState(0);
  const current = steps[step];

  return (
    <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
      <Card className="space-y-5">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-ink-muted)]">
          Step {step + 1} / {steps.length}
        </p>
        <div>
          <h2 className="text-2xl font-semibold text-white">{current.title}</h2>
          <p className="mt-3 text-base leading-8 text-[color:var(--color-ink-soft)]">
            {current.copy}
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={() => setStep((value) => Math.max(0, value - 1))}
            disabled={step === 0}
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <Button
            onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))}
            disabled={step === steps.length - 1}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      <Card className="grid min-h-[380px] place-items-center overflow-hidden">
        <div className="grid aspect-square w-full max-w-[420px] grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, outerIndex) => (
            <div
              key={outerIndex}
              className={`grid grid-cols-3 gap-1 rounded-xl border p-2 ${
                outerIndex === step + 2
                  ? "border-[color:var(--color-accent)] bg-[rgba(132,185,79,0.1)]"
                  : "border-[color:var(--color-line-soft)] bg-[rgba(0,0,0,0.08)]"
              }`}
            >
              {Array.from({ length: 9 }).map((__, innerIndex) => (
                <div
                  key={innerIndex}
                  className={`grid aspect-square place-items-center rounded-md border text-xs ${
                    step === 1 && outerIndex === 4 && innerIndex === 5
                      ? "border-[color:var(--color-accent)] bg-[rgba(132,185,79,0.14)] text-[color:var(--color-accent)]"
                      : "border-[color:var(--color-line-soft)] bg-[rgba(0,0,0,0.12)] text-[color:var(--color-ink-muted)]"
                  }`}
                >
                  {innerIndex + 1}
                </div>
              ))}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
