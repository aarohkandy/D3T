"use client";

import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import type { AppViewer } from "@/lib/auth/session";
import { getLegalMoves, type D3TMove } from "@/lib/d3t/engine";
import type { GameAggregate } from "@/lib/data/types";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

import { GameBoard } from "@/components/game/game-board";
import { MoveList } from "@/components/game/move-list";
import { Button } from "@/components/ui/button";

function formatClock(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function projectRemaining(game: GameAggregate, nowMs: number, syncedAtMs: number, mark: "X" | "O") {
  const base = mark === "X" ? game.clock.playerXRemainingMs : game.clock.playerORemainingMs;
  const playerId = mark === "X" ? game.playerXId : game.playerOId;

  if (game.status !== "active" || !playerId || game.currentTurnId !== playerId) {
    return base;
  }

  return Math.max(0, base - Math.max(0, nowMs - syncedAtMs));
}

function PlayerPanel({
  label,
  name,
  active,
  remainingMs,
  compact = false,
}: {
  label: string;
  name: string;
  active: boolean;
  remainingMs: number;
  compact?: boolean;
}) {
  return (
    <div className={compact
      ? "flex items-center justify-between rounded-2xl border border-[color:var(--color-line-soft)] bg-[color:var(--color-panel)] px-4 py-3 shadow-[0_14px_34px_rgba(96,73,48,0.05)]"
      : "flex items-center justify-between rounded-2xl border border-[color:var(--color-line-soft)] bg-[color:var(--color-panel)] px-5 py-4 shadow-[0_14px_34px_rgba(96,73,48,0.05)]"}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--color-ink-muted)]">{label}</p>
        <p className="mt-1 text-lg font-semibold text-[color:var(--color-ink)]">{name}</p>
      </div>
      <div className={active
        ? "rounded-xl bg-[color:var(--color-accent)] px-4 py-3 font-mono text-2xl font-semibold text-[color:var(--color-ink-strong)]"
        : "rounded-xl bg-[rgba(255,252,247,0.86)] px-4 py-3 font-mono text-2xl font-semibold text-[color:var(--color-ink)]"}>
        {formatClock(remainingMs)}
      </div>
    </div>
  );
}

export function GameRoomClient({
  initialGame,
  viewer,
}: {
  initialGame: GameAggregate;
  viewer: AppViewer;
}) {
  const router = useRouter();
  const initialSyncMs = Number.isNaN(Date.parse(initialGame.updatedAt)) ? 0 : Date.parse(initialGame.updatedAt);
  const [game, setGame] = useState(initialGame);
  const [syncedAtMs, setSyncedAtMs] = useState(initialSyncMs);
  const [nowMs, setNowMs] = useState(initialSyncMs);
  const [pending, startTransition] = useTransition();
  const [showForcedTargetHint, setShowForcedTargetHint] = useState(!viewer.hasSeenForcedTargetHint);

  const viewerIsPlayer = [game.playerXId, game.playerOId].includes(viewer.id);
  const canPlay = game.status === "active" && game.currentTurnId === viewer.id;
  const legalMoves = canPlay ? getLegalMoves(game.state) : [];
  const disconnectDeadlineMs = game.disconnectExpiresAt ? new Date(game.disconnectExpiresAt).getTime() : null;
  const disconnectCountdownMs = disconnectDeadlineMs ? Math.max(0, disconnectDeadlineMs - nowMs) : null;
  const opponentDisconnected = Boolean(
    game.status === "active" && game.disconnectPlayerId && game.disconnectPlayerId !== viewer.id,
  );
  const canClaimForfeit = Boolean(opponentDisconnected && disconnectCountdownMs === 0);

  const refreshGame = useEffectEvent(async () => {
    const response = await fetch(`/api/games/${game.id}`, { cache: "no-store" });
    const payload = await response.json();
    if (response.ok) {
      setGame(payload.game);
      setSyncedAtMs(Date.now());
    }
  });

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    const channel = supabase?.channel(`game:${game.id}`);

    channel?.on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "games",
      filter: `id=eq.${game.id}`,
    }, () => {
      void refreshGame();
    });

    channel?.on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "moves",
      filter: `game_id=eq.${game.id}`,
    }, () => {
      void refreshGame();
    });

    void channel?.subscribe();

    const interval = window.setInterval(() => {
      void refreshGame();
    }, supabase ? 10_000 : 2_000);

    return () => {
      window.clearInterval(interval);
      void channel?.unsubscribe();
    };
  }, [game.id]);

  useEffect(() => {
    if (!viewerIsPlayer || game.status !== "active") {
      return;
    }

    const sendPresence = async () => {
      const response = await fetch(`/api/games/${game.id}/presence`, { method: "POST" });
      const payload = await response.json();
      if (response.ok) {
        setGame(payload.game);
        setSyncedAtMs(Date.now());
      }
    };

    void sendPresence();
    const interval = window.setInterval(() => {
      void sendPresence();
    }, 15_000);

    return () => window.clearInterval(interval);
  }, [game.id, game.status, viewerIsPlayer]);

  async function runAction(path: string, body?: unknown) {
    const response = await fetch(path, {
      method: "POST",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await response.json();

    if (!response.ok) {
      toast.error(payload.error ?? "Action failed.");
      return null;
    }

    setGame(payload.game);
    setSyncedAtMs(Date.now());
    return payload.game as GameAggregate;
  }

  function handlePlay(move: D3TMove) {
    startTransition(async () => {
      await runAction(`/api/games/${game.id}/move`, move);
    });
  }

  const xRemainingMs = projectRemaining(game, nowMs, syncedAtMs, "X");
  const oRemainingMs = projectRemaining(game, nowMs, syncedAtMs, "O");

  async function acknowledgeForcedTargetHint() {
    setShowForcedTargetHint(false);
    await fetch("/api/onboarding/forced-target", { method: "POST" });
  }

  return (
    <main className="flex h-[100svh] w-full items-start justify-center overflow-hidden px-4 pb-4 pt-[72px] sm:px-6 sm:pt-[76px]">
      <div className="grid h-full w-full max-w-[1440px] gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="flex min-h-0 flex-col gap-4">
          <PlayerPanel
            label="Top"
            name={game.playerO?.username ?? "Waiting..."}
            active={game.currentTurnId === game.playerOId}
            remainingMs={oRemainingMs}
          />

          <div className="min-h-0 flex-1 rounded-[28px] border border-[color:var(--color-line-soft)] bg-[rgba(255,251,245,0.54)] p-3 shadow-[0_18px_44px_rgba(96,73,48,0.06)]">
            {showForcedTargetHint ? (
              <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-[rgba(128,89,54,0.16)] bg-[rgba(255,248,239,0.92)] px-4 py-3 text-sm text-[color:var(--color-ink-soft)]">
                <p>
                  Your move sends your opponent to the board at <span className="font-semibold text-[color:var(--color-ink)]">(t2, t3)</span>. If that board is closed, they can play anywhere.
                </p>
                <Button variant="secondary" size="sm" onClick={acknowledgeForcedTargetHint}>
                  Got it
                </Button>
              </div>
            ) : null}
            <GameBoard
              state={game.state}
              legalMoves={legalMoves}
              onPlay={handlePlay}
              disabled={!canPlay || pending}
            />
          </div>

          <PlayerPanel
            label="Bottom"
            name={game.playerX?.username ?? "Waiting..."}
            active={game.currentTurnId === game.playerXId}
            remainingMs={xRemainingMs}
          />

          <div className="flex items-center justify-between gap-3 rounded-2xl border border-[color:var(--color-line-soft)] bg-[color:var(--color-panel)] px-4 py-3">
            <div className="text-sm text-[color:var(--color-ink-muted)]">
              {opponentDisconnected && disconnectCountdownMs !== null
                ? `Opponent disconnected. ${canClaimForfeit ? "Claim the win now." : `Forfeit in ${formatCountdown(disconnectCountdownMs)}.`}`
                : game.status === "active"
                ? `Playing ${game.preset.label}`
                : game.winnerId
                  ? `${game.winnerId === viewer.id ? "You won" : "Game over"}`
                  : "Game over"}
            </div>
            <div className="flex items-center gap-2">
              {canClaimForfeit ? (
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      await runAction(`/api/games/${game.id}/claim-forfeit`);
                    });
                  }}
                >
                  Claim Forfeit
                </Button>
              ) : null}
              {viewerIsPlayer ? (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pending || game.status !== "active"}
                  onClick={() => {
                    startTransition(async () => {
                      await runAction(`/api/games/${game.id}/resign`);
                    });
                  }}
                >
                  Resign
                </Button>
              ) : null}
              <Button variant="secondary" size="sm" onClick={() => router.push("/")}>
                Home
              </Button>
            </div>
          </div>
        </section>

        <aside className="hidden min-h-0 lg:block">
          <MoveList moves={game.moves} />
        </aside>
      </div>
    </main>
  );
}
