import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BackgroundGlow } from "@/components/background-glow";
import { DeepAnalysisView } from "@/components/deep-analysis-view";
import { getDeepAnalysisById } from "@/lib/analysis/persist";
import { createClient } from "@/lib/supabase/server";

export default async function DeepAnalysisDetailPage(
  props: PageProps<"/dashboard/analyses/[id]">,
) {
  const { id } = await props.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const analysis = await getDeepAnalysisById(supabase, id);
  if (!analysis) {
    notFound();
  }

  return (
    <div className="relative flex min-h-screen flex-1 flex-col">
      <BackgroundGlow />

      <header className="relative z-10 px-6 py-6 sm:px-10">
        <Link
          href="/dashboard"
          className="text-sm text-foreground-muted transition-colors hover:text-foreground"
        >
          ← Retour au tableau de bord
        </Link>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-6 pb-24">
        <DeepAnalysisView analysis={analysis} />
      </main>
    </div>
  );
}
