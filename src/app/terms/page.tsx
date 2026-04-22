import type { Metadata } from "next";
import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Rules for using D3T, including accounts, gameplay, and acceptable use.",
};

const sections = [
  {
    title: "Using D3T",
    body: "By accessing D3T, you agree to use it only for lawful, respectful play and normal product interaction. You are responsible for your account activity and for keeping your sign-in details secure.",
  },
  {
    title: "Accounts and usernames",
    body: "Usernames are unique and may be visible to other players. We may restrict, reclaim, or rename usernames that violate these terms, impersonate others, or create confusion during public launch.",
  },
  {
    title: "Gameplay and competition",
    body: "D3T is challenge-first: it exists to let players create, accept, and resolve matches in a persistent game environment. Match results, clocks, reconnects, and resignations may be stored to keep the game state accurate.",
  },
  {
    title: "Prohibited conduct",
    body: "Do not abuse the service, attempt to break security, interfere with other players, scrape or automate the product in harmful ways, or use the site to harass, impersonate, or spam other users.",
  },
  {
    title: "Availability and changes",
    body: "The public launch may change, pause, or lose features while the product is still evolving. We can update, limit, or discontinue parts of the service at any time, including launch-period features.",
  },
];

export default function TermsPage() {
  return (
    <main className="mx-auto flex min-h-[100svh] w-full max-w-5xl items-start px-5 pb-16 pt-28 sm:px-8 sm:pt-32">
      <article className="w-full space-y-10 rounded-[28px] border border-[color:var(--color-line-soft)] bg-[rgba(255,251,245,0.86)] p-6 shadow-[0_24px_80px_rgba(80,58,36,0.08)] backdrop-blur-md sm:p-10">
        <header className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--color-ink-muted)]">
            Terms of Service
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.05em] text-[color:var(--color-ink)] sm:text-5xl">
            Terms for using the D3T launch site.
          </h1>
          <p className="max-w-3xl text-lg leading-8 text-[color:var(--color-ink-soft)]">
            These terms cover public access, accounts, gameplay, and fair use of the product. If you do not agree, please do not use D3T.
          </p>
          <p className="text-sm text-[color:var(--color-ink-muted)]">
            Effective date: April 22, 2026
          </p>
        </header>

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
              Ownership and feedback
            </h2>
            <p className="max-w-4xl text-base leading-7 text-[color:var(--color-ink-soft)]">
              The D3T brand, design, and software remain the property of their respective owners. Any feedback, suggestions, or bug reports you send may be used to improve the product without obligation to compensate you.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[color:var(--color-ink)]">
              Disclaimer
            </h2>
            <p className="max-w-4xl text-base leading-7 text-[color:var(--color-ink-soft)]">
              D3T is provided on an as-available basis. To the maximum extent allowed by law, we disclaim warranties and limit liability for service interruptions, data issues, and indirect damages arising from use of the site.
            </p>
          </section>
        </div>

        <footer className="flex flex-col gap-3 border-t border-[color:var(--color-line-soft)] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-[color:var(--color-ink-muted)]">
            For privacy details, see the Privacy Policy.
          </p>
          <div className="flex gap-3">
            <ButtonLink href="/privacy" variant="secondary" size="sm">
              Privacy
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
