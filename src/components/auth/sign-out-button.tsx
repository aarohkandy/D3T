"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";

export function SignOutButton({ localAuth }: { localAuth: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await fetch(localAuth ? "/api/local-auth" : "/api/auth/sign-out", {
            method: localAuth ? "DELETE" : "POST",
          });
          router.push("/");
          router.refresh();
        });
      }}
    >
      Sign Out
    </Button>
  );
}
