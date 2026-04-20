"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";

export function DemoExitButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await fetch("/api/local-auth", { method: "DELETE" });
          router.push("/");
          router.refresh();
        });
      }}
    >
      Sign Out
    </Button>
  );
}
