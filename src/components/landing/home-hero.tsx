import { ArrowRight, Check, Layers2, Network } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const featureCards = [
  {
    title: "Forced-path strategy",
    body: "Every move sends the next player somewhere specific, so positioning matters from turn one.",
    icon: Layers2,
  },
  {
    title: "Private online rooms",
    body: "Share one link, join fast, and let the server keep turns and legality honest.",
    icon: Network,
  },
  {
    title: "Readable at a glance",
    body: "The board shows what is playable, what is won, and where the next move has to land.",
    icon: Check,
  },
];

export function HomeHero() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-5 py-12 sm:px-8 lg:py-16">
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="space-y-8 p-8 sm:p-10">
          <div className="space-y-4">
            <Badge>Private online D3T</Badge>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[0.96] tracking-[-0.05em] text-white sm:text-6xl">
              Three layers.
              <br />
              One clean board.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-[color:var(--color-ink-soft)]">
              D3T turns your three-level tic-tac-toe into a simple online game with invite links,
              server-checked moves, replays, and a board that stays readable.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <ButtonLink href="/app" size="lg">
              Open the app
              <ArrowRight className="h-4 w-4" />
            </ButtonLink>
            <ButtonLink href="/tutorial" variant="secondary" size="lg">
              Learn the flow
            </ButtonLink>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {featureCards.map(({ title, body, icon: Icon }) => (
              <div key={title} className="rounded-xl border border-[color:var(--color-line-soft)] bg-[color:var(--color-panel-soft)] p-4">
                <Icon className="mb-3 h-4 w-4 text-[color:var(--color-accent)]" />
                <h2 className="text-sm font-semibold text-white">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-[color:var(--color-ink-muted)]">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid gap-6">
          <Card className="space-y-5">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-muted)]">
                How a turn works
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                The board tells the story.
              </h2>
            </div>
            <div className="space-y-4">
              {[
                "The first move can go anywhere.",
                "Your move sends the next player to a specific board.",
                "Win middle boards to claim the top board.",
              ].map((step) => (
                <div key={step} className="flex gap-3">
                  <div className="mt-1 h-2.5 w-2.5 rounded-full bg-[color:var(--color-accent)]" />
                  <p className="text-sm leading-7 text-[color:var(--color-ink-soft)]">{step}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="space-y-3">
            <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-muted)]">
              Local first
            </p>
            <p className="text-sm leading-7 text-[color:var(--color-ink-soft)]">
              Mock auth is built in, so you can switch between local players and test invite games
              on `localhost` before wiring up Clerk, Neon, and Liveblocks for Vercel.
            </p>
          </Card>
        </div>
      </section>
    </main>
  );
}
