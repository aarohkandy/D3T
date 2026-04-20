import { notFound } from "next/navigation";

import { isDevDemoEnabled } from "@/lib/config";

import { DemoEntryList } from "@/components/dev/demo-entry-list";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function DemoPage() {
  if (!isDevDemoEnabled()) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-[100svh] w-full max-w-4xl items-center px-5 py-16 sm:px-8">
      <Card className="w-full space-y-8">
        <div className="space-y-3 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--color-ink-muted)]">
            Localhost Demo
          </p>
          <h1 className="text-4xl font-semibold tracking-[-0.04em] text-white">Choose a demo account.</h1>
          <p className="mx-auto max-w-[620px] text-base leading-7 text-[color:var(--color-ink-soft)]">
            This route exists only for local testing while Clerk and the hosted backend are still unconfigured.
          </p>
        </div>
        <DemoEntryList />
        <div className="flex justify-center">
          <ButtonLink href="/" variant="secondary">
            Back Home
          </ButtonLink>
        </div>
      </Card>
    </main>
  );
}
