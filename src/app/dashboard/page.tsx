import { redirect } from "next/navigation";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getDashboardStats } from "@/lib/dashboard/stats";
import { isOnFreePlan } from "@/lib/courses/plan";
import { listCourses } from "@/lib/courses/persist";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

// Prompt 06.4 : le tableau de bord s'affiche désormais TOUJOURS, y compris
// sans aucune formation générée — à 0, chaque stat reste une vraie valeur
// (jamais masquée derrière un unique écran "bibliothèque vide"). Seule la
// section "Formations récentes" affiche un message compact à la place de
// la liste quand elle est vide, plutôt qu'un gros bloc occupant toute la
// page.

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
    coursesCreatedThisWeek: 0,
    courseCountSeries: [],
    quizScoreSeries: [],
    quizScoreTrend: null,
    estimatedReadingMinutesTotal: 0,
  }));

  const recentCourses = [...courses]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, RECENT_COURSES_LIMIT);

  const firstName = user.email?.split("@")[0] ?? "";

  return (
    <DashboardShell userEmail={user.email ?? ""} isPro={!locked} onSignOut={signOut}>
      <DashboardOverview
        stats={stats}
        recentCourses={recentCourses}
        locked={locked}
        firstName={firstName}
      />
    </DashboardShell>
  );
}
