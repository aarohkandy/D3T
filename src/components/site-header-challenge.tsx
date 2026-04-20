"use client";

import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function SiteHeaderChallenge({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [presetId, setPresetId] = useState("blitz");
  const [pending, startTransition] = useTransition();

  async function submitChallenge() {
    const response = await fetch("/api/challenges", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username,
        presetId,
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      toast.error(payload.error ?? "Could not send challenge.");
      return;
    }

    setUsername("");
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-w-0 max-w-[min(72vw,580px)] flex-1 items-center gap-2 rounded-2xl border border-[color:var(--color-line-soft)] bg-[rgba(255,252,247,0.84)] p-2 shadow-[0_16px_40px_rgba(90,66,44,0.1)] backdrop-blur-md">
      <select
        value={presetId}
        disabled={disabled || pending}
        onChange={(event) => setPresetId(event.target.value)}
        className="h-11 rounded-xl border border-[color:var(--color-line-soft)] bg-[color:var(--color-panel-soft)] px-3 text-sm font-medium text-[color:var(--color-ink)] outline-none"
      >
        <option value="bullet">1 + 0</option>
        <option value="blitz">3 + 2</option>
        <option value="rapid">5 + 0</option>
        <option value="classic">10 + 0</option>
      </select>
      <input
        value={username}
        onChange={(event) => setUsername(event.target.value)}
        placeholder="challenge username"
        disabled={disabled || pending}
        className="h-11 min-w-0 flex-1 rounded-xl border border-[color:var(--color-line-soft)] bg-[color:var(--color-panel-soft)] px-4 text-sm text-[color:var(--color-ink)] outline-none placeholder:text-[color:var(--color-ink-muted)]"
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (!disabled && username.trim()) {
              startTransition(async () => {
                await submitChallenge();
              });
            }
          }
        }}
      />
      <Button
        size="md"
        className="shrink-0"
        disabled={disabled || pending || !username.trim()}
        onClick={() => {
          startTransition(async () => {
            await submitChallenge();
          });
        }}
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
