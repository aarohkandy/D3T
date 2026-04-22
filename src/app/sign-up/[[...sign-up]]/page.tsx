import { redirect } from "next/navigation";

import { getViewer } from "@/lib/auth/session";
import { isLocalAuthEnabled, isSupabaseAuthEnabled } from "@/lib/config";
import { MOCK_VIEWERS } from "@/lib/dev/mock-session";

import { AuthUnavailableCard } from "@/components/auth/auth-unavailable-card";
import { LocalAuthForm } from "@/components/auth/local-auth-form";
import { SupabaseAuthForm } from "@/components/auth/supabase-auth-form";
import { FakeMatchBackground } from "@/components/landing/fake-match-background";

export default async function SignUpPage() {
  const viewer = await getViewer();

  if (viewer) {
    redirect("/");
  }

  return (
    <main className="relative flex min-h-[100svh] items-center justify-center overflow-hidden px-4 py-16">
      <FakeMatchBackground />
      {isSupabaseAuthEnabled()
        ? <SupabaseAuthForm mode="sign-up" />
        : isLocalAuthEnabled()
          ? <LocalAuthForm mode="sign-up" seedViewers={MOCK_VIEWERS} />
          : <AuthUnavailableCard />}
    </main>
  );
}
