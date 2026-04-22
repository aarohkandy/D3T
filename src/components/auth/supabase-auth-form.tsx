"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function SupabaseAuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const isSignUp = mode === "sign-up";

  async function submit() {
    const response = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(
        isSignUp
          ? {
              email,
              password,
              username,
              displayName,
            }
          : {
              email,
              password,
            },
      ),
    });

    const payload = await response.json();
    if (!response.ok) {
      toast.error(payload.error ?? "Could not continue.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <Card className="relative z-10 w-full max-w-[980px] border-[color:var(--color-line-strong)] bg-[rgba(249,242,232,0.84)] px-8 py-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
        <div className="space-y-6">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[color:var(--color-ink-muted)]">
              {isSignUp ? "Create account" : "Welcome back"}
            </p>
            <h1 className="text-5xl font-semibold tracking-[-0.08em] text-[color:var(--color-ink)]">
              {isSignUp ? "Start your beta account." : "Log in to D3T."}
            </h1>
            <p className="max-w-[470px] text-base leading-7 text-[color:var(--color-ink-soft)]">
              {isSignUp
                ? "Use email and password for the first public beta, then challenge people by username."
                : "Sign in with the same email and password you used when you created your D3T account."}
            </p>
          </div>

          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              startTransition(async () => {
                await submit();
              });
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-medium text-[color:var(--color-ink-soft)]">Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="h-12 w-full rounded-xl border border-[color:var(--color-line-strong)] bg-[rgba(255,252,247,0.9)] px-4 text-[color:var(--color-ink)] outline-none"
                />
              </label>

              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-medium text-[color:var(--color-ink-soft)]">Password</span>
                <input
                  type="password"
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="8+ characters"
                  className="h-12 w-full rounded-xl border border-[color:var(--color-line-strong)] bg-[rgba(255,252,247,0.9)] px-4 text-[color:var(--color-ink)] outline-none"
                />
              </label>

              {isSignUp ? (
                <>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-[color:var(--color-ink-soft)]">Username</span>
                    <input
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      placeholder="grandmasterttt"
                      className="h-12 w-full rounded-xl border border-[color:var(--color-line-strong)] bg-[rgba(255,252,247,0.9)] px-4 text-[color:var(--color-ink)] outline-none"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-[color:var(--color-ink-soft)]">Display name</span>
                    <input
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      placeholder="D3T Player"
                      className="h-12 w-full rounded-xl border border-[color:var(--color-line-strong)] bg-[rgba(255,252,247,0.9)] px-4 text-[color:var(--color-ink)] outline-none"
                    />
                  </label>
                </>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="submit"
                size="lg"
                disabled={pending || !email.trim() || password.trim().length < 8 || (isSignUp && username.trim().length < 2)}
              >
                {isSignUp ? "Create Account" : "Log In"}
              </Button>
              <Link
                href={isSignUp ? "/sign-in" : "/sign-up"}
                className="text-sm font-medium text-[color:var(--color-ink-soft)] underline underline-offset-4"
              >
                {isSignUp ? "Already have an account?" : "Need an account?"}
              </Link>
            </div>
          </form>
        </div>

        <div className="space-y-4 rounded-[24px] border border-[color:var(--color-line-soft)] bg-[rgba(255,252,247,0.68)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--color-ink-muted)]">
              Beta Flow
            </p>
            <p className="text-lg font-semibold text-[color:var(--color-ink)]">Challenges first</p>
          </div>
          <ul className="space-y-3 text-sm leading-6 text-[color:var(--color-ink-soft)]">
            <li>Pick your account once.</li>
            <li>Choose a username people can challenge.</li>
            <li>Send or accept friend challenges from the hub.</li>
            <li>Play live with persistent clocks and reconnect protection.</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}
