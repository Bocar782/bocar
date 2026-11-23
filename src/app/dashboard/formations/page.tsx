import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { LibraryBrowser } from "@/components/dashboard/library-browser";
import { IconChartLine, IconGraduationCap, IconTarget } from "@/components/marketing/icons";
import { CourseListItem } from "@/components/course-list-item";
import { Button } from "@/components/ui/button";
import { listDeepAnalyses } from "@/lib/analysis/persist";
import { computeCourseProgress } from "@/lib/courses/progress";
import { isOnFreePlan } from "@/lib/courses/plan";
import { listCourses } from "@/lib/courses/persist";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../actions";

const RESUME_LIMIT = 3;

function MiniStat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border-subtle bg-background-card p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-violet-tint text-accent-violet">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-lg font-semibold text-foreground">{value}</p>
        <p className="truncate text-xs text-foreground-muted">{label}</p>
      </div>
    </div>
  );
}

export default async function LibraryPage(props: PageProps<"/dashboard/formations">) {
  const searchParams = await props.searchParams;
  const initialQueryRaw = searchParams?.q;
  const initialQuery = Array.isArray(initialQueryRaw) ? initialQueryRaw[0] : initialQueryRaw;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [courses, analyses, locked] = await Promise.all([
    listCourses(supabase, user.id).catch(() => []),
    listDeepAnalyses(supabase, user.id).catch(() => []),
    isOnFreePlan(supabase, user.id).catch(() => true),
  ]);

  // Formations "en cours" (ni jamais commencées, ni terminées), les plus
  // récemment créées en premier — pour proposer de reprendre là où
  // l'utilisateur s'est arrêté, sans dupliquer la liste complète en dessous.
  const inProgress = courses
    .map((course) => ({ course, progress: computeCourseProgress(course) }))
    .filter((c) => c.progress.status === "in_progress")
    .slice(0, RESUME_LIMIT);

  const coursesWithProgress = courses.map((c) => computeCourseProgress(c).percent);
  const avgProgress =
    coursesWithProgress.length > 0
      ? Math.round(coursesWithProgress.reduce((a, b) => a + b, 0) / coursesWithProgress.length)
      : 0;

  return (
    <DashboardShell userEmail={user.email ?? ""} isPro={!locked} onSignOut={signOut}>
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Bibliothèque
            </h1>
            <p className="mt-1 text-sm text-foreground-muted">
              Toutes tes formations et analyses, au même endroit.
            </p>
          </div>
          <Button href="/dashboard/creer">+ Nouvelle formation</Button>
        </div>

        <section className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MiniStat
            icon={<IconGraduationCap width={18} height={18} />}
            label="Formations"
            value={String(courses.length)}
          />
          <MiniStat
            icon={<IconChartLine width={18} height={18} />}
            label="Analyses approfondies"
            value={String(analyses.length)}
          />
          <MiniStat
            icon={<IconTarget width={18} height={18} />}
            label="Progression moyenne"
            value={courses.length > 0 ? `${avgProgress}%` : "—"}
          />
        </section>

        {inProgress.length > 0 && (
          <section className="mt-10">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">
                Reprendre où tu t&apos;es arrêté
              </h2>
              <Link
                href="/dashboard"
                className="text-xs font-medium text-accent-violet-light hover:text-accent-violet"
              >
                Tableau de bord →
              </Link>
            </div>
            <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {inProgress.map(({ course }) => (
                <CourseListItem key={course.id} course={course} />
              ))}
            </ul>
          </section>
        )}

        <section className="mt-10">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-foreground-muted">
            Toute la bibliothèque
          </h2>
          <LibraryBrowser courses={courses} analyses={analyses} initialQuery={initialQuery ?? ""} />
        </section>
      </div>
    </DashboardShell>
  );
}
