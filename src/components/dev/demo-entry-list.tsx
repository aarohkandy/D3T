"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { MOCK_VIEWERS } from "@/lib/dev/mock-session";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function DemoEntryList() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {MOCK_VIEWERS.map((viewer) => (
        <Card key={viewer.id} className="space-y-4">
          <div>
            <p className="text-lg font-semibold text-[color:var(--color-ink)]">{viewer.username}</p>
            <p className="text-sm text-[color:var(--color-ink-muted)]">@{viewer.username}</p>
          </div>
          <Button
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                await fetch("/api/local-auth", {
                  method: "POST",
                  headers: {
                    "content-type": "application/json",
                  },
                  body: JSON.stringify({
                    mode: "sign-in",
                    username: viewer.username,
                  }),
                });

                router.push("/");
                router.refresh();
              });
            }}
          >
            Enter Demo
          </Button>
        </Card>
      ))}
    </div>
  );
}
