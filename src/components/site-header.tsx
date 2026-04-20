import type { AppViewer } from "@/lib/auth/session";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { SiteHeaderChallenge } from "@/components/site-header-challenge";
import { ButtonLink } from "@/components/ui/button";

export function SiteHeader({ viewer }: { viewer: AppViewer | null }) {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-30">
      <div className="flex w-full items-start justify-between gap-4 px-4 pt-4 sm:px-6">
        <div className="pointer-events-auto flex min-w-0 items-center gap-3">
          {viewer ? <SiteHeaderChallenge disabled={!viewer} /> : null}
        </div>

        <div className="pointer-events-auto flex shrink-0 items-center gap-3 rounded-2xl border border-[color:var(--color-line-soft)] bg-[rgba(255,252,247,0.88)] p-2 shadow-[0_16px_40px_rgba(90,66,44,0.08)] backdrop-blur-md">
          {viewer ? (
            <>
              <div className="hidden rounded-xl bg-[rgba(255,251,245,0.92)] px-3 py-2 text-sm font-semibold text-[color:var(--color-ink)] sm:block">
                @{viewer.username}
              </div>
              <SignOutButton localAuth={viewer.isMock} />
            </>
          ) : (
            <>
              <ButtonLink href="/sign-up" size="sm">
                Sign Up
              </ButtonLink>
              <ButtonLink href="/sign-in" variant="secondary" size="sm">
                Log In
              </ButtonLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
