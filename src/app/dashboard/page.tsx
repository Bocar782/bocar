import Link from "next/link";
import { redirect } from "next/navigation";
import { BackgroundGlow } from "@/components/background-glow";
import { BrandMark } from "@/components/brand-mark";
import { CourseListItem } from "@/components/course-list-item";
import { DeepAnalysisListItem } from "@/components/deep-analysis-list-item";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { listDeepAnalyses } from "@/lib/analysis/persist";
import { getAnalysisUsageStatus, getUsageStatus } from "@/lib/courses/plan";
import { listCourses } from "@/lib/courses/persist";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";
import { GeneratorTabs } from "./generator-tabs";

const DEFAULT_USAGE = { isPro: false, used: 0, limit: 1, remaining: 1, resetsAt: null };

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Si la migration SQL n'a pas encore été appliquée côté Supabase, ne pas
  // faire planter tout le dashboard : l'utilisateur voit juste des listes
  // vides et un quota par défaut.
  const [courses, analyses, usage, analysisUsage] = await Promise.all([
    listCourses(supabase, user.id).catch(() => []),
    listDeepAnalyses(supabase, user.id).catch(() => []),
    getUsageStatus(supabase, user.id).catch(() => DEFAULT_USAGE),
    getAnalysisUsageStatus(supabase, user.id).catch(() => ({ ...DEFAULT_USAGE, limit: 0, remaining: 0 })),
  ]);

  const onFreePlan = !usage.isPro;

  return (
    <div className="relative flex min-h-screen flex-1 flex-col">
      <BackgroundGlow />

      <header className="relative z-10 flex items-center justify-between gap-3 px-6 py-6 sm:px-10">
        <div className="flex shrink-0 items-center gap-2">
          <BrandMark size={32} />
          <span className="text-lg font-semibold tracking-tight">Tavyra</span>
        </div>

        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <span className="min-w-0 truncate text-sm text-foreground-muted">{user.email}</span>
          <form action={signOut} className="shrink-0">
            <Button type="submit" variant="secondary">
              Se déconnecter
            </Button>
          </form>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-6 pb-24 pt-8 sm:pt-16">
        <h1 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
          Que veux-tu apprendre aujourd&apos;hui ?
        </h1>
        <p className="mt-2 max-w-md text-center text-sm text-foreground-muted">
          Décris un sujet, Tavyra construit ta formation complète.
        </p>

        <div className="mt-10 flex w-full flex-1 flex-col items-center">
          <GeneratorTabs
            courseRemainingGenerations={usage.remaining}
            courseLocked={onFreePlan}
            analysisRemainingGenerations={analysisUsage.remaining}
            analysisIsPro={analysisUsage.isPro}
          />
        </div>

        <section className="mt-6 w-full max-w-2xl space-y-3">
          <div>
            <div className="flex items-center justify-between rounded-xl border border-border-subtle bg-white/[0.02] px-4 py-3">
              <span className="text-xs text-foreground-muted">
                {onFreePlan ? "Plan gratuit" : "Plan Pro"}
              </span>
              <span className="text-xs font-medium text-foreground">
                {usage.used}/{usage.limit} formation{usage.limit > 1 ? "s" : ""}{" "}
                générée{usage.limit > 1 ? "s" : ""}
                {usage.isPro && usage.resetsAt
                  ? ` (renouvellement le ${new Date(usage.resetsAt).toLocaleDateString("fr-FR")})`
                  : onFreePlan
                    ? " (à vie)"
                    : ""}
              </span>
            </div>
            {onFreePlan && (
              <Link
                href="/pricing"
                className="mt-2 block text-center text-xs text-accent-violet-light underline underline-offset-2 hover:text-accent-violet"
              >
                Passer au plan Pro
              </Link>
            )}
            {!onFreePlan && (
              <form action="/api/stripe/portal" method="POST" className="mt-2">
                <button
                  type="submit"
                  className="block w-full text-center text-xs text-foreground-muted underline underline-offset-2 hover:text-foreground"
                >
                  Gérer mon abonnement
                </button>
              </form>
            )}
          </div>

          {analysisUsage.isPro && (
            <div className="flex items-center justify-between rounded-xl border border-border-subtle bg-white/[0.02] px-4 py-3">
              <span className="text-xs text-foreground-muted">Analyses approfondies</span>
              <span className="text-xs font-medium text-foreground">
                {analysisUsage.used}/{analysisUsage.limit} ce mois
                {analysisUsage.resetsAt
                  ? ` (renouvellement le ${new Date(analysisUsage.resetsAt).toLocaleDateString("fr-FR")})`
                  : ""}
              </span>
            </div>
          )}
        </section>

        {courses.length > 0 && (
          <section className="mt-10 w-full max-w-2xl">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">
              Mes formations
            </h2>
            <ul className="mt-4 space-y-3">
              {courses.map((course) => (
                <CourseListItem key={course.id} course={course} />
              ))}
            </ul>
          </section>
        )}

        {analyses.length > 0 && (
          <section className="mt-10 w-full max-w-2xl">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">
              Mes analyses approfondies
            </h2>
            <ul className="mt-4 space-y-3">
              {analyses.map((analysis) => (
                <DeepAnalysisListItem key={analysis.id} analysis={analysis} />
              ))}
            </ul>
          </section>
        )}

        {courses.length === 0 && analyses.length === 0 && (
          <EmptyState
            className="mt-10"
            description="Aucune formation pour l'instant — lance ta première génération ci-dessus."
          />
        )}
      </main>
    </div>
  );
}
