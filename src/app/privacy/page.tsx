import type { Metadata } from "next";
import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How D3T collects, uses, and protects player information.",
};

const sections = [
  {
    title: "What we collect",
    body: "D3T collects the information needed to run accounts, matches, and leaderboards. That can include your username, email address, game activity, timestamps, device and browser information, and basic logs needed to keep the service healthy.",
  },
  {
    title: "How we use it",
    body: "We use data to create and secure accounts, store games, match players, restore sessions, prevent abuse, debug issues, and improve the product. We may also use aggregated usage data to understand launch traffic and feature adoption.",
  },
  {
    title: "Who we share it with",
    body: "We do not sell personal information. We may share data with the service providers that operate D3T, including hosting, authentication, database, and observability vendors such as Vercel and Supabase, plus any other processors needed to run the site.",
  },
  {
    title: "Cookies and local storage",
    body: "D3T uses cookies and local storage where needed for sign-in, session persistence, and basic product functionality. On localhost, the app may fall back to local auth and in-memory data so development stays usable.",
  },
  {
    title: "Retention and deletion",
    body: "We keep account and gameplay data for as long as it is needed to provide the service, meet legal obligations, resolve disputes, and maintain the integrity of ongoing or historical matches. If you need help deleting an account or specific data, contact the team that operates the launch instance.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-[100svh] w-full max-w-5xl items-start px-5 pb-16 pt-28 sm:px-8 sm:pt-32">
      <article className="w-full space-y-10 rounded-[28px] border border-[color:var(--color-line-soft)] bg-[rgba(255,251,245,0.86)] p-6 shadow-[0_24px_80px_rgba(80,58,36,0.08)] backdrop-blur-md sm:p-10">
        <header className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--color-ink-muted)]">
            Privacy Policy
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.05em] text-[color:var(--color-ink)] sm:text-5xl">
            How D3T handles player data.
          </h1>
          <p className="max-w-3xl text-lg leading-8 text-[color:var(--color-ink-soft)]">
            This policy is written for the public launch version of D3T. It explains what we collect, why we collect it, and how we protect it while the game runs on the web.
          </p>
          <p className="text-sm text-[color:var(--color-ink-muted)]">
            Effective date: April 22, 2026
          </p>
        </header>

        <section className="grid gap-4 rounded-3xl border border-[color:var(--color-line-soft)] bg-[rgba(255,255,255,0.5)] p-5 sm:grid-cols-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--color-ink-muted)]">
              Scope
            </p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--color-ink-soft)]">
              Public launch site, account system, and game records.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--color-ink-muted)]">
              Primary processors
            </p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--color-ink-soft)]">
              Hosting, auth, database, and monitoring providers used to operate the service.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--color-ink-muted)]">
              Contact
            </p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--color-ink-soft)]">
              Use the project&apos;s official support or privacy contact for deletion and access requests.
            </p>
          </div>
        </section>

        <div className="space-y-6">
          {sections.map((section) => (
            <section key={section.title} className="space-y-3">
              <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[color:var(--color-ink)]">
                {section.title}
              </h2>
              <p className="max-w-4xl text-base leading-7 text-[color:var(--color-ink-soft)]">
                {section.body}
              </p>
            </section>
          ))}

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[color:var(--color-ink)]">
              Your choices
            </h2>
            <p className="max-w-4xl text-base leading-7 text-[color:var(--color-ink-soft)]">
              You can stop using the service at any time, sign out of your account, or request account help through the project&apos;s support channel. If you do not want analytics-like launch data collected in your browser session, use the service only after reviewing the current product settings and browser privacy controls.
            </p>
          </section>
        </div>

        <footer className="flex flex-col gap-3 border-t border-[color:var(--color-line-soft)] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-[color:var(--color-ink-muted)]">
            This page is part of the D3T launch site and may be updated as the product evolves.
          </p>
          <div className="flex gap-3">
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
