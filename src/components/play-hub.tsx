"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import type { AppViewer } from "@/lib/auth/session";
import type { ChallengeAggregate, HubData, TimePresetId } from "@/lib/data/types";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

import { FakeMatchBackground } from "@/components/landing/fake-match-background";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

function PresetSelector({
  selectedPreset,
  onSelect,
}: {
  selectedPreset: TimePresetId;
  onSelect: (presetId: TimePresetId) => void;
}) {
  const presets: Array<{ id: TimePresetId; label: string }> = [
    { id: "bullet", label: "1 + 0" },
    { id: "blitz", label: "3 + 2" },
    { id: "rapid", label: "5 + 0" },
    { id: "classic", label: "10 + 0" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {presets.map((preset) => (
        <button
          key={preset.id}
          type="button"
          onClick={() => onSelect(preset.id)}
          className={selectedPreset === preset.id
            ? "rounded-full border border-[rgba(58,42,28,0.18)] bg-[color:var(--color-accent)] px-4 py-2 text-sm font-semibold text-[color:var(--color-ink-strong)] shadow-[0_10px_24px_rgba(86,63,42,0.16)]"
            : "rounded-full border border-[color:var(--color-line-soft)] bg-[rgba(255,252,247,0.78)] px-4 py-2 text-sm font-medium text-[color:var(--color-ink)]"}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}

function ChallengeCard({
  challenge,
  onAccept,
  onDecline,
}: {
  challenge: ChallengeAggregate;
  onAccept?: (challengeId: string) => void;
  onDecline?: (challengeId: string) => void;
}) {
  const label = onAccept || onDecline
    ? `${challenge.fromUser?.username ?? "Unknown"} wants to play ${challenge.preset.label}`
    : `Waiting on ${challenge.toUser?.username ?? "Unknown"} for ${challenge.preset.label}`;

  return (
    <div className="flex items-center justify-between gap-4 rounded-[24px] border border-[color:var(--color-line-soft)] bg-[rgba(255,251,245,0.76)] px-4 py-4 shadow-[0_14px_34px_rgba(96,73,48,0.06)]">
      <div>
        <p className="text-sm font-semibold text-[color:var(--color-ink)]">
          {label}
        </p>
        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-muted)]">
          {challenge.preset.description}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {onDecline ? (
          <Button variant="secondary" size="sm" onClick={() => onDecline(challenge.id)}>
            Decline
          </Button>
        ) : null}
        {onAccept ? (
          <Button size="sm" onClick={() => onAccept(challenge.id)}>
            Accept
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function PlayHub({
  viewer,
  initialHub,
  challengeOnlyBeta,
}: {
  viewer: AppViewer | null;
  initialHub: HubData | null;
  challengeOnlyBeta: boolean;
}) {
  const router = useRouter();
  const [hub, setHub] = useState(initialHub);
  const [selectedPreset, setSelectedPreset] = useState<TimePresetId>("blitz");
  const [challengeName, setChallengeName] = useState("");
  const [pending, startTransition] = useTransition();

  const refreshHub = useCallback(async () => {
    if (!viewer) {
      return;
    }

    const response = await fetch("/api/me", { cache: "no-store" });
    const payload = await response.json();
    if (response.ok) {
      setHub(payload.hub);

      if (payload.hub?.activeGame?.id) {
        router.push(`/play/${payload.hub.activeGame.id}`);
        router.refresh();
      }
    }
  }, [router, viewer]);

  useEffect(() => {
    if (!viewer) {
      return;
    }

    const supabase = getBrowserSupabaseClient();
    const channel = supabase?.channel(`hub:${viewer.id}`);

    channel?.on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "games",
      filter: `player_x_id=eq.${viewer.id}`,
    }, () => {
      void refreshHub();
    });

    channel?.on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "games",
      filter: `player_o_id=eq.${viewer.id}`,
    }, () => {
      void refreshHub();
    });

    channel?.on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "challenges",
      filter: `from_user_id=eq.${viewer.id}`,
    }, () => {
      void refreshHub();
    });

    channel?.on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "challenges",
      filter: `to_user_id=eq.${viewer.id}`,
    }, () => {
      void refreshHub();
    });

    void channel?.subscribe();

    const interval = window.setInterval(() => {
      void refreshHub();
    }, supabase ? 12_000 : 3_000);

    return () => {
      window.clearInterval(interval);
      void channel?.unsubscribe();
    };
  }, [viewer, refreshHub]);

  async function joinQueue() {
    const response = await fetch("/api/queue", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        presetId: selectedPreset,
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      toast.error(payload.error ?? "Could not start quick play.");
      return;
    }

    if (payload.game?.id) {
      router.push(`/play/${payload.game.id}`);
      router.refresh();
      return;
    }

    await refreshHub();
  }

  async function cancelQueue() {
    const response = await fetch("/api/queue", { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) {
      toast.error(payload.error ?? "Could not cancel the queue.");
      return;
    }

    await refreshHub();
  }

  async function sendChallenge() {
    const response = await fetch("/api/challenges", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: challengeName,
        presetId: selectedPreset,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      toast.error(payload.error ?? "Could not send challenge.");
      return;
    }

    setChallengeName("");
    await refreshHub();
  }

  async function acceptChallenge(challengeId: string) {
    const response = await fetch(`/api/challenges/${challengeId}/accept`, { method: "POST" });
    const payload = await response.json();
    if (!response.ok) {
      toast.error(payload.error ?? "Could not accept challenge.");
      return;
    }

    router.push(`/play/${payload.game.id}`);
    router.refresh();
  }

  async function declineChallenge(challengeId: string) {
    const response = await fetch(`/api/challenges/${challengeId}/decline`, { method: "POST" });
    const payload = await response.json();
    if (!response.ok) {
      toast.error(payload.error ?? "Could not decline challenge.");
      return;
    }

    await refreshHub();
  }

  if (!viewer) {
    return (
      <main className="relative flex min-h-[100svh] items-center justify-center overflow-hidden px-4 py-16">
        <FakeMatchBackground />
        <Card className="relative z-10 w-full max-w-[1040px] border-[color:var(--color-line-strong)] bg-[rgba(249,242,232,0.78)] p-8 sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_360px] lg:items-center">
            <div className="space-y-6">
              <h1 className="text-6xl font-semibold tracking-[-0.12em] text-[color:var(--color-ink)] sm:text-7xl">
                D3T
              </h1>
              <p className="max-w-[440px] text-xl leading-8 text-[color:var(--color-ink-soft)]">
                Grandfather Tic-Tac-Toe with three nested boards, forced replies, and live head-to-head games.
              </p>
              <div className="flex flex-wrap gap-3">
                <span className="rounded-full border border-[color:var(--color-line-soft)] bg-[rgba(255,251,245,0.8)] px-4 py-2 text-sm font-medium text-[color:var(--color-ink)]">
                  Friend challenges
                </span>
                <span className="rounded-full border border-[color:var(--color-line-soft)] bg-[rgba(255,251,245,0.8)] px-4 py-2 text-sm font-medium text-[color:var(--color-ink)]">
                  Live clocks
                </span>
                {challengeOnlyBeta ? (
                  <span className="rounded-full border border-[color:var(--color-line-soft)] bg-[rgba(255,251,245,0.8)] px-4 py-2 text-sm font-medium text-[color:var(--color-ink)]">
                    Challenges-first beta
                  </span>
                ) : null}
              </div>
              <p className="max-w-[460px] text-sm leading-7 text-[color:var(--color-ink-muted)]">
                {challengeOnlyBeta
                  ? "Create an account, choose a username, and start with direct friend challenges."
                  : "Pick a clock, create an account, and start playing in a few seconds."}
              </p>
            </div>

            <div className="space-y-5 rounded-[28px] border border-[color:var(--color-line-soft)] bg-[rgba(255,252,247,0.86)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] sm:p-6">
              <div className="space-y-2">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--color-ink-muted)]">
                  Pick a Clock
                </p>
                <p className="text-lg font-semibold text-[color:var(--color-ink)]">
                  {challengeOnlyBeta
                    ? "Pick the time control you want to send with your challenge."
                    : "Start with the time control you want to play."}
                </p>
              </div>

              <PresetSelector selectedPreset={selectedPreset} onSelect={setSelectedPreset} />

              <div className="grid gap-3">
                <ButtonLink href="/sign-up" size="lg">
                  Create Account
                </ButtonLink>
                <ButtonLink href="/sign-in" variant="secondary" size="lg">
                  Log In
                </ButtonLink>
              </div>
            </div>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-[100svh] items-center justify-center overflow-hidden px-4 py-16">
      <FakeMatchBackground />
      <div className="relative z-10 flex w-full max-w-[1100px] flex-col gap-6">
        <Card className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--color-ink-muted)]">
              Play
            </p>
            <h1 className="text-4xl font-semibold tracking-[-0.06em] text-[color:var(--color-ink)]">Start a game.</h1>
          </div>

          <PresetSelector selectedPreset={selectedPreset} onSelect={setSelectedPreset} />

          <div className={challengeOnlyBeta ? "grid gap-3" : "grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"}>
            {!challengeOnlyBeta ? (
              <div className="rounded-[24px] border border-[color:var(--color-line-soft)] bg-[rgba(255,251,245,0.72)] p-5 shadow-[0_14px_34px_rgba(96,73,48,0.06)]">
                <p className="text-sm font-semibold text-[color:var(--color-ink)]">Quick Play</p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--color-ink-muted)]">
                  Join the {selectedPreset} queue and get paired by time control and a loose rating band.
                </p>
                <div className="mt-4 flex items-center gap-3">
                  {hub?.queueEntry ? (
                    <>
                      <Button
                        size="lg"
                        onClick={() => {
                          startTransition(async () => {
                            await cancelQueue();
                          });
                        }}
                        disabled={pending}
                      >
                        Cancel Search
                      </Button>
                      <p className="text-sm text-[color:var(--color-ink-muted)]">
                        Searching {hub.queueEntry.preset.label}
                      </p>
                    </>
                  ) : (
                    <Button
                      size="lg"
                      onClick={() => {
                        startTransition(async () => {
                          await joinQueue();
                        });
                      }}
                      disabled={pending}
                    >
                      Quick Play
                    </Button>
                  )}
                </div>
              </div>
            ) : null}

            <div className="rounded-[24px] border border-[color:var(--color-line-soft)] bg-[rgba(255,251,245,0.72)] p-5 shadow-[0_14px_34px_rgba(96,73,48,0.06)]">
              <p className="text-sm font-semibold text-[color:var(--color-ink)]">Play a Friend</p>
              <p className="mt-2 text-sm leading-6 text-[color:var(--color-ink-muted)]">
                Send a challenge by username and let them accept it from their hub.
              </p>
              <div className="mt-4 flex gap-3">
                <input
                  value={challengeName}
                  onChange={(event) => setChallengeName(event.target.value)}
                  placeholder="username"
                  className="h-12 min-w-0 flex-1 rounded-xl border border-[color:var(--color-line-soft)] bg-[color:var(--color-panel-soft)] px-4 text-[color:var(--color-ink)] outline-none"
                />
                <Button
                  size="lg"
                  disabled={pending || !challengeName.trim()}
                  onClick={() => {
                    startTransition(async () => {
                      await sendChallenge();
                    });
                  }}
                >
                  Send
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {hub?.incomingChallenges?.length ? (
          <Card className="space-y-4">
            <p className="text-lg font-semibold text-[color:var(--color-ink)]">Incoming challenges</p>
            {hub.incomingChallenges.map((challenge) => (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                onAccept={acceptChallenge}
                onDecline={declineChallenge}
              />
            ))}
          </Card>
        ) : null}

        {hub?.outgoingChallenges?.length ? (
          <Card className="space-y-4">
            <p className="text-lg font-semibold text-[color:var(--color-ink)]">Sent challenges</p>
            {hub.outgoingChallenges.map((challenge) => (
              <ChallengeCard key={challenge.id} challenge={challenge} />
            ))}
          </Card>
        ) : null}
      </div>
    </main>
  );
}
