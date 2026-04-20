"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function CreateGameButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [joiningCode, setJoiningCode] = useState("");

  async function handleCreate() {
    startTransition(async () => {
      const response = await fetch("/api/games", {
        method: "POST",
      });

      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "Could not create a game.");
        return;
      }

      toast.success("Invite room ready.");
      router.push(`/play/${payload.game.id}`);
    });
  }

  function handleJoin() {
    if (!joiningCode.trim()) {
      toast.error("Paste a game link or id first.");
      return;
    }

    const trimmed = joiningCode.trim();
    const gameId = trimmed.includes("/play/") ? trimmed.split("/play/").pop() : trimmed;
    router.push(`/play/${gameId}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <Button onClick={handleCreate} disabled={pending}>
          {pending ? "Opening room..." : "Start invite game"}
        </Button>
      </div>
      <div className="flex flex-col gap-3 rounded-xl border border-[color:var(--color-line-soft)] bg-[color:var(--color-panel-soft)] p-4 sm:flex-row">
        <input
          value={joiningCode}
          onChange={(event) => setJoiningCode(event.target.value)}
          placeholder="Paste a game URL or room id"
          className="h-11 flex-1 rounded-lg border border-[color:var(--color-line-soft)] bg-[color:var(--color-bg-elevated)] px-4 text-sm text-white outline-none transition placeholder:text-[color:var(--color-ink-muted)] focus:border-[color:var(--color-line-strong)]"
        />
        <Button onClick={handleJoin} variant="secondary">
          Open room
        </Button>
      </div>
    </div>
  );
}
