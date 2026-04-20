import Link from "next/link";
import { Clock3, Crown, History, Radio } from "lucide-react";

import type { GameAggregate } from "@/lib/data/types";
import { formatRelativeTime } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export function GameList({
  title,
  games,
}: {
  title: string;
  games: GameAggregate[];
}) {
  return (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b border-[color:var(--color-line-soft)] px-6 py-4">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <Badge>{games.length} games</Badge>
      </div>
      <div className="divide-y divide-[color:var(--color-line-soft)]">
        {games.length === 0 ? (
          <div className="px-6 py-10 text-sm text-[color:var(--color-ink-muted)]">
            Nothing here yet. Start a room and the board history will appear here.
          </div>
        ) : (
          games.map((game) => {
            const href = game.status === "active" || game.status === "pending"
              ? `/play/${game.id}`
              : `/history/${game.id}`;

            return (
              <Link
                key={game.id}
                href={href}
                className="grid gap-3 px-6 py-5 transition hover:bg-white/3 sm:grid-cols-[1fr_auto]"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-white">
                      {game.playerX?.username ?? "waiting"} vs {game.playerO?.username ?? "waiting"}
                    </span>
                    <Badge>{game.status}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-[color:var(--color-ink-muted)]">
                    <span className="inline-flex items-center gap-2">
                      <History className="h-4 w-4" />
                      {game.moves.length} moves
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Clock3 className="h-4 w-4" />
                      {formatRelativeTime(game.updatedAt)}
                    </span>
                    {game.winnerId ? (
                      <span className="inline-flex items-center gap-2 text-[color:var(--color-accent)]">
                        <Crown className="h-4 w-4" />
                        Winner locked in
                      </span>
                    ) : game.status === "active" ? (
                      <span className="inline-flex items-center gap-2 text-[color:var(--color-accent)]">
                        <Radio className="h-4 w-4" />
                        Live room
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="self-center text-sm font-semibold text-[color:var(--color-accent)]">
                  Open
                </div>
              </Link>
            );
          })
        )}
      </div>
    </Card>
  );
}
