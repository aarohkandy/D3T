"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

type MockUserOption = {
  id: string;
  displayName: string;
  username: string;
};

export function MockUserSwitcher({
  currentUserId,
  users,
}: {
  currentUserId: string;
  users: MockUserOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <label className="inline-flex items-center rounded-lg border border-[color:var(--color-line-soft)] bg-[color:var(--color-panel-soft)] px-3 py-2 text-sm text-[color:var(--color-ink-muted)] shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
      <select
        className="min-w-28 bg-transparent font-medium text-[color:var(--color-ink)] outline-none"
        value={currentUserId}
        disabled={pending}
        onChange={(event) => {
          startTransition(async () => {
            await fetch("/api/mock/session", {
              method: "POST",
              headers: {
                "content-type": "application/json",
              },
              body: JSON.stringify({
                userId: event.target.value,
              }),
            });
            router.refresh();
          });
        }}
      >
        {users.map((user) => (
          <option key={user.id} value={user.id} className="bg-[color:var(--color-bg-elevated)]">
            {user.username}
          </option>
        ))}
      </select>
    </label>
  );
}
