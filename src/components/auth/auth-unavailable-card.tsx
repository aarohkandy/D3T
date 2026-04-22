import { Card } from "@/components/ui/card";

export function AuthUnavailableCard() {
  return (
    <Card className="relative z-10 w-full max-w-[620px] bg-[rgba(249,242,232,0.88)] p-8 text-center">
      <h1 className="text-4xl font-semibold tracking-[-0.06em] text-[color:var(--color-ink)]">
        D3T auth is not configured.
      </h1>
      <p className="mx-auto mt-4 max-w-[440px] text-sm leading-6 text-[color:var(--color-ink-soft)]">
        Add the Supabase environment variables in Vercel to enable sign up and log in for players.
      </p>
    </Card>
  );
}
