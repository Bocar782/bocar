import Link from "next/link";
import { redirect } from "next/navigation";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { ActivityBarChart, ProgressRing } from "@/components/dashboard/charts";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { CourseListItem } from "@/components/course-list-item";
import { IconGraduationCap } from "@/components/marketing/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getDashboardStats } from "@/lib/dashboard/stats";
import { isOnFreePlan } from "@/lib/courses/plan";
import { listCourses } from "@/lib/courses/persist";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

const RECENT_COURSES_LIMIT = 4;

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Si la migration SQL n'a pas encore été appliquée côté Supabase, ne pas
  // faire planter tout le dashboard : l'utilisateur voit juste des stats
  // vides par défaut.
  const [courses, locked] = await Promise.all([
    listCourses(supabase, user.id).catch(() => []),
    isOnFreePlan(supabase, user.id).catch(() => true),
  ]);

  const stats = await getDashboardStats(supabase, user.id, courses).catch(() => ({
    totalCourses: courses.length,
    completedCourses: 0,
    inProgressCourses: 0,
    avgProgressPercent: 0,
    quizzesCompleted: 0,
    avgQuizScorePercent: null,
    activeDayStreak: 0,
    activityByDay: [],
    recentActivity: [],
  }));

  const recentCourses = [...courses]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, RECENT_COURSES_LIMIT);

  const firstName = user.email?.split("@")[0] ?? "";

  return (
    <DashboardShell userEmail={user.email ?? ""} isPro={!locked} onSignOut={signOut}>
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Bonjour{firstName ? `, ${firstName}` : ""}
            </h1>
            <p className="mt-1 text-sm text-foreground-muted">
              Voici un aperçu de ton apprentissage avec Tavyra.
            </p>
          </div>
          <Button href="/dashboard/creer">+ Nouvelle formation</Button>
        </div>

        {courses.length === 0 ? (
          <EmptyState
            className="mt-10 w-full"
            icon={<IconGraduationCap width={22} height={22} />}
            title="Ta bibliothèque est vide pour l'instant"
            description="Lance ta première génération — ta formation apparaîtra ici, prête à reprendre où tu veux."
            action={<Button href="/dashboard/creer">Créer ma première formation</Button>}
          />
        ) : (
          <>
            <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card padding="sm">
                <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  Formations
                </p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{stats.totalCourses}</p>
                <p className="mt-0.5 text-xs text-foreground-muted">
                  {stats.completedCourses} terminée{stats.completedCourses > 1 ? "s" : ""}
                </p>
              </Card>
              <Card padding="sm">
                <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  En cours
                </p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {stats.inProgressCourses}
                </p>
                <p className="mt-0.5 text-xs text-foreground-muted">formation(s) active(s)</p>
              </Card>
              <Card padding="sm">
                <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  Quiz complétés
                </p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {stats.quizzesCompleted}
                </p>
                <p className="mt-0.5 text-xs text-foreground-muted">
                  {stats.avgQuizScorePercent !== null
                    ? `Score moyen : ${stats.avgQuizScorePercent}%`
                    : "Aucun score pour l'instant"}
                </p>
              </Card>
              <Card padding="sm">
                <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  Série active
                </p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {stats.activeDayStreak} jour{stats.activeDayStreak > 1 ? "s" : ""}
                </p>
                <p className="mt-0.5 text-xs text-foreground-muted">jours consécutifs</p>
              </Card>
            </section>

            <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <h2 className="text-sm font-semibold text-foreground">Progression globale</h2>
                <div className="mt-5">
                  <ProgressRing
                    percent={stats.avgProgressPercent}
                    label="Avancement moyen"
                    sublabel={`sur ${stats.totalCourses} formation${stats.totalCourses > 1 ? "s" : ""}`}
                  />
                </div>
              </Card>
              <Card>
                <h2 className="text-sm font-semibold text-foreground">
                  Activité des 14 derniers jours
                </h2>
                <div className="mt-5">
                  <ActivityBarChart data={stats.activityByDay} />
                </div>
              </Card>
            </section>

            <section className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[1.4fr_1fr]">
              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">
                    Formations récentes
                  </h2>
                  <Link
                    href="/dashboard/formations"
                    className="text-xs font-medium text-accent-violet-light hover:text-accent-violet"
                  >
                    Voir tout →
                  </Link>
                </div>
                <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {recentCourses.map((course) => (
                    <CourseListItem key={course.id} course={course} />
                  ))}
                </ul>
              </div>

              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">
                  Activité récente
                </h2>
                <Card className="mt-4" padding="sm">
                  <ActivityFeed events={stats.recentActivity} />
                </Card>
              </div>
            </section>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
