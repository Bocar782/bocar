import { redirect } from "next/navigation";
import { BackgroundGlow } from "@/components/background-glow";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="relative flex min-h-screen flex-1 flex-col">
      <BackgroundGlow />

      <header className="relative z-10 flex items-center justify-between px-6 py-6 sm:px-10">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent-blue to-accent-violet text-sm font-semibold text-white shadow-[0_0_24px_-4px_var(--accent-violet)]">
            L
          </span>
          <span className="text-lg font-semibold tracking-tight">Lia</span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-foreground-muted">{user.email}</span>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-full border border-border-subtle bg-white/5 px-4 py-2 text-sm font-medium text-foreground backdrop-blur transition-colors hover:bg-white/10"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Ton tableau de bord arrive bientôt
        </h1>
        <p className="mt-2 max-w-md text-sm text-foreground-muted">
          Tes formations, ta progression et tes quiz s&apos;afficheront ici.
        </p>
      </main>
    </div>
  );
}
