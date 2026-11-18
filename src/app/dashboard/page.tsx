import Link from "next/link";
import { redirect } from "next/navigation";
import { BackgroundGlow } from "@/components/background-glow";
import { BrandMark } from "@/components/brand-mark";
import { CourseListItem } from "@/components/course-list-item";
import { DeepAnalysisListItem } from "@/components/deep-analysis-list-item";
import { IconGraduationCap } from "@/components/marketing/icons";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { listDeepAnalyses } from "@/lib/analysis/persist";
import { getUsageStatuses } from "@/lib/courses/plan";
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
  const [courses, analyses, usages] = await Promise.all([
    listCourses(supabase, user.id).catch(() => []),
    listDeepAnalyses(supabase, user.id).catch(() => []),
    getUsageStatuses(supabase, user.id).catch(() => ({
      course: DEFAULT_USAGE,
      analysis: { ...DEFAULT_USAGE, limit: 0, remaining: 0 },
    })),
  ]);
  const { course: usage, analysis: analysisUsage } = usages;

  const onFreePlan = !usage.isPro;

  return (
    <div className="relative flex min-h-screen flex-1 flex-col">
      <BackgroundGlow />

      <header className="sticky top-0 z-20 border-b border-transparent bg-background/80 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3 px-6 py-5 sm:px-10">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
            <BrandMark size={32} />
            <span className="text-lg font-semibold tracking-tight">Tavyra</span>
          </Link>

          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <span className="hidden min-w-0 truncate text-sm text-foreground-muted sm:inline">
              {user.email}
            </span>
            <form action={signOut} className="shrink-0">
              <Button type="submit" variant="secondary" size="sm">
                Se déconnecter
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-6 pb-24 pt-10 sm:pt-16">
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

        <section className="mt-8 grid w-full max-w-2xl gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border-subtle bg-white/[0.02] p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
                {onFreePlan ? "Plan gratuit" : "Plan Pro"}
              </span>
              {!onFreePlan && (
                <span className="rounded-full bg-accent-violet/15 px-2 py-0.5 text-[10px] font-medium text-accent-violet-light">
                  Pro
                </span>
              )}
            </div>
            <p className="mt-2 text-sm font-medium text-foreground">
              {usage.used}/{usage.limit} formation{usage.limit > 1 ? "s" : ""} générée
              {usage.limit > 1 ? "s" : ""}
            </p>
            <p className="mt-0.5 text-xs text-foreground-muted">
              {usage.isPro && usage.resetsAt
                ? `Renouvellement le ${new Date(usage.resetsAt).toLocaleDateString("fr-FR")}`
                : onFreePlan
                  ? "Quota à vie"
                  : ""}
            </p>
            {onFreePlan ? (
              <Link
                href="/pricing"
                className="mt-3 inline-block text-xs font-medium text-accent-violet-light underline underline-offset-2 hover:text-accent-violet"
              >
                Passer au plan Pro
              </Link>
            ) : (
              <form action="/api/stripe/portal" method="POST" className="mt-3">
                <button
                  type="submit"
                  className="text-xs font-medium text-foreground-muted underline underline-offset-2 hover:text-foreground"
                >
                  Gérer mon abonnement
                </button>
              </form>
            )}
          </div>

          {analysisUsage.isPro && (
            <div className="rounded-2xl border border-border-subtle bg-white/[0.02] p-4">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
                Analyses approfondies
              </span>
              <p className="mt-2 text-sm font-medium text-foreground">
                {analysisUsage.used}/{analysisUsage.limit} ce mois
              </p>
              <p className="mt-0.5 text-xs text-foreground-muted">
                {analysisUsage.resetsAt
                  ? `Renouvellement le ${new Date(analysisUsage.resetsAt).toLocaleDateString("fr-FR")}`
                  : ""}
              </p>
            </div>
          )}
        </section>

        {courses.length > 0 && (
          <section className="mt-12 w-full max-w-4xl">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">
                Mes formations
              </h2>
              <span className="text-xs text-foreground-muted">{courses.length}</span>
            </div>
            <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <CourseListItem key={course.id} course={course} />
              ))}
            </ul>
          </section>
        )}

        {analyses.length > 0 && (
          <section className="mt-12 w-full max-w-4xl">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">
                Mes analyses approfondies
              </h2>
              <span className="text-xs text-foreground-muted">{analyses.length}</span>
            </div>
            <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {analyses.map((analysis) => (
                <DeepAnalysisListItem key={analysis.id} analysis={analysis} />
              ))}
            </ul>
          </section>
        )}

        {courses.length === 0 && analyses.length === 0 && (
          <EmptyState
            className="mt-12 w-full max-w-2xl"
            icon={<IconGraduationCap width={22} height={22} />}
            title="Ta bibliothèque est vide pour l'instant"
            description="Lance ta première génération ci-dessus — ta formation apparaîtra ici, prête à reprendre où tu veux."
          />
        )}
      </main>
    </div>
  );
}
