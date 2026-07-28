"use client";

import { useEffect, useEffectEvent, useState, useTransition, type CSSProperties } from "react";
import { toast } from "sonner";

import type { AppViewer } from "@/lib/auth/session";
import { getLegalMoves, type D3TMove } from "@/lib/d3t/engine";
import type { GameAggregate } from "@/lib/data/types";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

import { GameBoard } from "@/components/game/game-board";

function formatClock(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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
  mark,
  name,
  relation,
  active,
  remainingMs,
  initialMs,
}: {
  mark: "X" | "O";
  name: string;
  relation: string;
  active: boolean;
  remainingMs: number;
  initialMs: number;
}) {
  const expired = remainingMs <= 0;
  const clockFill = Math.max(0, Math.min(100, (remainingMs / Math.max(1, initialMs)) * 100));
  const critical = !expired && clockFill <= 12;
  const low = !expired && clockFill <= 28;
  const panelStyle = {
    "--clock-fill": `${clockFill}%`,
  } as CSSProperties;

  return (
    <div
      className={cn(
        "d3t-player-card",
        mark === "X" ? "is-x" : "is-o",
        active && "is-active",
        low && "is-low",
        critical && "is-critical",
        expired && "is-expired",
      )}
      style={panelStyle}
    >
      <div className="d3t-player-card__identity">
        <div className="d3t-player-card__glyph" aria-hidden="true">
          {mark}
        </div>
        <div className="d3t-player-card__copy">
          <p className="d3t-player-card__name">{name}</p>
          <p className="d3t-player-card__relation">{expired ? "Flagged" : relation}</p>
        </div>
      </div>
      <div className="d3t-player-card__readout">
        <div className="d3t-clock">
          <span>{formatClock(remainingMs)}</span>
          <span className="d3t-clock__fuse" aria-hidden="true" />
        </div>
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
  const initialSyncMs = Number.isNaN(Date.parse(initialGame.updatedAt))
    ? 0
    : Date.parse(initialGame.updatedAt);
  const [game, setGame] = useState(initialGame);
  const [syncedAtMs, setSyncedAtMs] = useState(initialSyncMs);
  const [nowMs, setNowMs] = useState(initialSyncMs);
  const [pending, startTransition] = useTransition();

  const viewerIsPlayer = [game.playerXId, game.playerOId].includes(viewer.id);
  const canPlay = game.status === "active" && game.currentTurnId === viewer.id;
  const legalMoves = canPlay ? getLegalMoves(game.state) : [];

  const refreshGame = useEffectEvent(async () => {
    try {
      const response = await fetch(`/api/games/${game.id}`, { cache: "no-store" });
      const payload = await response.json();
      if (response.ok) {
        setGame(payload.game);
        setSyncedAtMs(Date.now());
      }
    } catch {
      // Reloads and tab sleeps can cancel polling requests; the next poll will resync.
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

    channel?.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "games",
        filter: `id=eq.${game.id}`,
      },
      () => {
        void refreshGame();
      },
    );

    channel?.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "moves",
        filter: `game_id=eq.${game.id}`,
      },
      () => {
        void refreshGame();
      },
    );

    void channel?.subscribe();
    const pollMs =
      game.status === "active" && game.currentTurnId !== viewer.id
        ? 2_000
        : supabase
          ? 10_000
          : 2_000;

    const interval = window.setInterval(() => {
      void refreshGame();
    }, pollMs);

    return () => {
      window.clearInterval(interval);
      void channel?.unsubscribe();
    };
  }, [game.currentTurnId, game.id, game.status, viewer.id]);

  useEffect(() => {
    if (!viewerIsPlayer || game.status !== "active") {
      return;
    }

    const sendPresence = async () => {
      try {
        const response = await fetch(`/api/games/${game.id}/presence`, { method: "POST" });
        const payload = await response.json();
        if (response.ok) {
          setGame(payload.game);
          setSyncedAtMs(Date.now());
        }
      } catch {
        // Presence gets refreshed frequently, so transient browser fetch failures are harmless.
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
  const xRelation = game.playerXId === viewer.id ? "You" : "Opponent";
  const oRelation = game.playerOId === viewer.id ? "You" : "Opponent";

  return (
    <main className="d3t-play-screen flex h-[100svh] w-full items-center justify-center overflow-hidden px-2 py-2 sm:px-3">
      <div className="d3t-play-screen__texture" aria-hidden="true" />
      <section className="d3t-match-shell">
        <PlayerPanel
          mark="O"
          name={game.playerO?.username ?? "Waiting..."}
          relation={oRelation}
          active={game.currentTurnId === game.playerOId}
          remainingMs={oRemainingMs}
          initialMs={game.clock.initialMs}
        />

        <div className="d3t-board-stage">
          <GameBoard
            state={game.state}
            legalMoves={legalMoves}
            onPlay={handlePlay}
            disabled={!canPlay || pending}
          />
        </div>

        <PlayerPanel
          mark="X"
          name={game.playerX?.username ?? "Waiting..."}
          relation={xRelation}
          active={game.currentTurnId === game.playerXId}
          remainingMs={xRemainingMs}
          initialMs={game.clock.initialMs}
        />
      </section>
    </main>
  );
}
