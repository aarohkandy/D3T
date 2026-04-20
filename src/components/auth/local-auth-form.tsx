"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { AppViewer } from "@/lib/auth/session";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function LocalAuthForm({
  mode,
  seedViewers,
}: {
  mode: "sign-in" | "sign-up";
  seedViewers: AppViewer[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");

  const isSignUp = mode === "sign-up";

  async function submitAuth(payload: Record<string, string>) {
    const response = await fetch("/api/local-auth", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!response.ok) {
      toast.error(result.error ?? "Could not continue.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <Card className="relative z-10 w-full max-w-[920px] border-[color:var(--color-line-strong)] bg-[rgba(249,242,232,0.82)] px-8 py-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-6">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[color:var(--color-ink-muted)]">
              {isSignUp ? "Create Account" : "Welcome Back"}
            </p>
            <h1 className="text-5xl font-semibold tracking-[-0.08em] text-[color:var(--color-ink)]">
              {isSignUp ? "Start playing." : "Log in."}
            </h1>
            <p className="max-w-[420px] text-base leading-7 text-[color:var(--color-ink-soft)]">
              {isSignUp
                ? "Create an account and jump straight into quick play or friend challenges."
                : "Use your username to jump back into the game flow instantly."}
            </p>
          </div>

          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              startTransition(async () => {
                await submitAuth(isSignUp
                  ? {
                    mode,
                    username,
                    displayName,
                    email,
                  }
                  : {
                    mode,
                    username,
                  });
              });
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-medium text-[color:var(--color-ink-soft)]">Username</span>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="d3tplayer"
                  className="h-12 w-full rounded-xl border border-[color:var(--color-line-strong)] bg-[rgba(255,252,247,0.86)] px-4 text-[color:var(--color-ink)] outline-none"
                />
              </label>

              {isSignUp ? (
                <>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-[color:var(--color-ink-soft)]">Display name</span>
                    <input
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      placeholder="D3T Player"
                      className="h-12 w-full rounded-xl border border-[color:var(--color-line-strong)] bg-[rgba(255,252,247,0.86)] px-4 text-[color:var(--color-ink)] outline-none"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-[color:var(--color-ink-soft)]">Email</span>
                    <input
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      className="h-12 w-full rounded-xl border border-[color:var(--color-line-strong)] bg-[rgba(255,252,247,0.86)] px-4 text-[color:var(--color-ink)] outline-none"
                    />
                  </label>
                </>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="submit"
                size="lg"
                disabled={pending || username.trim().length < 2}
              >
                {isSignUp ? "Create Account" : "Log In"}
              </Button>
              <Link
                href={isSignUp ? "/sign-in" : "/sign-up"}
                className="text-sm font-medium text-[color:var(--color-ink-soft)] underline underline-offset-4"
              >
                {isSignUp ? "Already have a local account?" : "Need a local account?"}
              </Link>
            </div>
          </form>
        </div>

        <div className="space-y-4 rounded-[24px] border border-[color:var(--color-line-soft)] bg-[rgba(255,252,247,0.62)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
          <div className="space-y-1">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--color-ink-muted)]">
              Quick Start
            </p>
            <p className="text-base font-semibold text-[color:var(--color-ink)]">Local test accounts</p>
          </div>

          <div className="space-y-2">
            {seedViewers.slice(0, 4).map((viewer) => (
              <button
                key={viewer.id}
                type="button"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    await submitAuth({
                      mode: "sign-in",
                      username: viewer.username,
                    });
                  });
                }}
                className="flex w-full items-center justify-between rounded-2xl border border-[color:var(--color-line-soft)] bg-[rgba(255,252,247,0.72)] px-4 py-3 text-left transition hover:border-[color:var(--color-line-strong)]"
              >
                <span>
                  <span className="block text-sm font-semibold text-[color:var(--color-ink)]">{viewer.displayName}</span>
                  <span className="block text-xs text-[color:var(--color-ink-muted)]">@{viewer.username}</span>
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--color-ink-muted)]">
                  Use
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
