import Link from "next/link";
import { redirect } from "next/navigation";
import { BackgroundGlow } from "@/components/background-glow";
import { CourseListItem } from "@/components/course-list-item";
import { FREE_PLAN_COURSE_LIMIT, isOnFreePlan } from "@/lib/courses/plan";
import { countTotalGenerations, listCourses } from "@/lib/courses/persist";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";
import { CourseGenerator } from "./course-generator";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const onFreePlan = await isOnFreePlan(supabase, user.id);

  // Si la migration SQL n'a pas encore été appliquée côté Supabase, ne pas
  // faire planter tout le dashboard : l'utilisateur voit juste une liste vide
  // et un quota par défaut.
  const [courses, totalGenerated] = await Promise.all([
    listCourses(supabase, user.id).catch(() => []),
    countTotalGenerations(supabase, user.id).catch(() => 0),
  ]);

  const remainingGenerations = onFreePlan
    ? Math.max(0, FREE_PLAN_COURSE_LIMIT - totalGenerated)
    : Infinity;

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

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-6 pb-24 pt-8 sm:pt-16">
        <h1 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
          Que veux-tu apprendre aujourd&apos;hui ?
        </h1>
        <p className="mt-2 max-w-md text-center text-sm text-foreground-muted">
          Décris un sujet, Lia construit ta formation complète.
        </p>

        <div className="mt-10 flex w-full flex-1 flex-col items-center">
          <CourseGenerator remainingGenerations={remainingGenerations} locked={onFreePlan} />
        </div>

        <section className="mt-6 w-full max-w-2xl">
          <div className="flex items-center justify-between rounded-xl border border-border-subtle bg-white/[0.02] px-4 py-3">
            <span className="text-xs text-foreground-muted">
              {onFreePlan ? "Plan gratuit" : "Utilisation"}
            </span>
            <span className="text-xs font-medium text-foreground">
              {onFreePlan
                ? `${totalGenerated}/${FREE_PLAN_COURSE_LIMIT} formation${FREE_PLAN_COURSE_LIMIT > 1 ? "s" : ""} générée${FREE_PLAN_COURSE_LIMIT > 1 ? "s" : ""}`
                : `${totalGenerated} formations générées`}
            </span>
          </div>
          {onFreePlan && (
            <Link
              href="/tarifs"
              className="mt-2 block text-center text-xs text-accent-violet-light underline underline-offset-2 hover:text-accent-violet"
            >
              Passer au plan Pro
            </Link>
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

        {courses.length === 0 && (
          <p className="mt-10 text-sm text-foreground-muted">
            Aucune formation pour l&apos;instant — lance ta première
            génération ci-dessus.
          </p>
        )}
      </main>
    </div>
  );
}
