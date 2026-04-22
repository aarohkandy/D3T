import type { Metadata } from "next";
import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Press Kit",
  description: "Brand copy, facts, and downloadable launch assets for D3T.",
};

const facts = [
  ["Product", "D3T"],
  ["Category", "Three-layer Grandfather Tic-Tac-Toe"],
  ["Launch focus", "Challenge-first multiplayer web gameplay"],
  ["Stack", "Next.js, Supabase, Postgres, Vercel"],
];

const assets = [
  { label: "D3T wordmark", href: "/press/d3t-wordmark.svg" },
  { label: "D3T mark", href: "/press/d3t-mark.svg" },
  { label: "Launch OG image", href: "/press/d3t-og.svg" },
];

export default function PresskitPage() {
  return (
    <main className="mx-auto flex min-h-[100svh] w-full max-w-6xl items-start px-5 pb-16 pt-28 sm:px-8 sm:pt-32">
      <article className="w-full space-y-10 rounded-[28px] border border-[color:var(--color-line-soft)] bg-[rgba(255,251,245,0.86)] p-6 shadow-[0_24px_80px_rgba(80,58,36,0.08)] backdrop-blur-md sm:p-10">
        <header className="grid gap-8 lg:grid-cols-[1.25fr_0.9fr] lg:items-end">
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--color-ink-muted)]">
              Press Kit
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.05em] text-[color:var(--color-ink)] sm:text-5xl">
              D3T launch copy and brand assets.
            </h1>
            <p className="max-w-3xl text-lg leading-8 text-[color:var(--color-ink-soft)]">
              D3T is a polished web home for three-layer Grandfather Tic-Tac-Toe, built for challenge-first play and persistent game state. Use this page for launch coverage, store listings, or partner references.
            </p>
          </div>

          <div className="rounded-3xl border border-[color:var(--color-line-soft)] bg-[rgba(255,255,255,0.52)] p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--color-ink-muted)]">
              Boilerplate
            </p>
            <p className="mt-3 text-base leading-7 text-[color:var(--color-ink-soft)]">
              D3T is a three-layer Grandfather Tic-Tac-Toe platform for players who want thoughtful turn-based matches on the web, with modern account, challenge, and persistence features.
            </p>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {facts.map(([label, value]) => (
            <div
              key={label}
              className="rounded-3xl border border-[color:var(--color-line-soft)] bg-[rgba(255,255,255,0.52)] p-5"
            >
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--color-ink-muted)]">
                {label}
              </p>
              <p className="mt-2 text-base leading-7 text-[color:var(--color-ink-soft)]">
                {value}
              </p>
            </div>
          ))}
        </section>

        <section className="grid gap-8 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[color:var(--color-ink)]">
              Downloadable assets
            </h2>
            <div className="space-y-3">
              {assets.map((asset) => (
                <a
                  key={asset.href}
                  href={asset.href}
                  className="flex items-center justify-between rounded-2xl border border-[color:var(--color-line-soft)] bg-[rgba(255,255,255,0.55)] px-4 py-3 text-[color:var(--color-ink)] transition hover:border-[color:var(--color-line-strong)] hover:bg-[rgba(255,252,247,0.94)]"
                  download
                >
                  <span className="font-medium">{asset.label}</span>
                  <span className="text-sm text-[color:var(--color-ink-muted)]">SVG</span>
                </a>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[color:var(--color-ink)]">
              Brand guidance
            </h2>
            <ul className="space-y-3 text-base leading-7 text-[color:var(--color-ink-soft)]">
              <li>Use the D3T name in uppercase when space allows.</li>
              <li>Prefer the wordmark for articles, landing pages, and launch coverage.</li>
              <li>Use the square mark for avatars, app icons, and tight placements.</li>
              <li>Keep the logo clear of heavy filters, borders, or other marks.</li>
            </ul>
            <p className="text-base leading-7 text-[color:var(--color-ink-soft)]">
              If you need a larger preview asset, the OG image is sized for social and embed use. It inherits the same launch palette and can be referenced directly from this site.
            </p>
          </div>
        </section>

        <section className="space-y-4 rounded-3xl border border-[color:var(--color-line-soft)] bg-[rgba(255,255,255,0.52)] p-5">
          <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[color:var(--color-ink)]">
            Suggested launch copy
          </h2>
          <p className="max-w-4xl text-base leading-7 text-[color:var(--color-ink-soft)]">
            D3T brings three-layer Grandfather Tic-Tac-Toe to the web with persistent matches, challenge-first gameplay, and a launch-ready product stack built on Next.js, Supabase, Postgres, and Vercel.
          </p>
        </section>

        <footer className="flex flex-col gap-3 border-t border-[color:var(--color-line-soft)] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-[color:var(--color-ink-muted)]">
            Public pages: press kit, privacy, and terms.
          </p>
          <div className="flex gap-3">
            <ButtonLink href="/privacy" variant="secondary" size="sm">
              Privacy
            </ButtonLink>
            <ButtonLink href="/terms" variant="secondary" size="sm">
              Terms
            </ButtonLink>
            <Link
              href="/"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-[color:var(--color-line-soft)] bg-[rgba(255,252,247,0.96)] px-4 text-sm font-semibold text-[color:var(--color-ink)] shadow-[0_10px_24px_rgba(80,58,36,0.08)]"
            >
              Back home
            </Link>
          </div>
        </footer>
      </article>
    </main>
  );
}
