import Link from "next/link";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { ActivityBarChart, ProgressRing } from "@/components/dashboard/charts";
import { IconFlame, IconLibrary } from "@/components/dashboard/icons";
import { StatCard } from "@/components/dashboard/stat-card";
import { CourseListItem } from "@/components/course-list-item";
import { IconChartLine, IconGraduationCap, IconTarget } from "@/components/marketing/icons";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { computeCourseProgress } from "@/lib/courses/progress";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PRO_PLAN_FEATURES, PRO_PLAN_PRICE_EUR } from "@/lib/courses/plan";
import { TopicSuggestions } from "@/components/dashboard/topic-suggestions";
import type { DashboardStats } from "@/lib/dashboard/stats";

type RecentCourse = {
  id: string;
  title: string;
  domain: string;
  level: string;
  chapterCount: number;
  currentChapterIndex: number | null;
  quizScore: number | null;
  quizTotal: number | null;
};

function formatReadingTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest}`;
}

export function DashboardOverview({
  stats,
  recentCourses,
  locked,
  firstName,
}: {
  stats: DashboardStats;
  recentCourses: RecentCourse[];
  locked: boolean;
  firstName: string;
}) {
  // Formation à reprendre : la plus récente encore en cours (données réelles).
  const resumeCourse = recentCourses.find(
    (course) => computeCourseProgress(course).status === "in_progress",
  );
  const resumeChapter = resumeCourse?.currentChapterIndex ?? 0;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <section className="rise relative overflow-hidden rounded-3xl px-6 py-7 sm:px-8 sm:py-8">
        <div aria-hidden className="bg-brand absolute inset-0" />
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_60%_90%_at_85%_0%,rgba(255,255,255,0.3),transparent_65%)]"
        />
        <div
          aria-hidden
          className="absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-[#e879f9]/30 blur-3xl"
        />
        <div aria-hidden className="absolute right-8 top-1/2 hidden -translate-y-1/2 lg:block">
          <div className="float-y flex h-28 w-28 rotate-6 items-center justify-center rounded-[28px] bg-white/95 shadow-[0_20px_50px_-16px_rgba(20,5,50,0.6)]">
            <BrandMark size={76} />
          </div>
        </div>

        <div className="relative max-w-2xl lg:pr-36">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
            Ton espace d&apos;apprentissage
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Bonjour{firstName ? `, ${firstName}` : ""} 👋
          </h1>
          <p className="mt-2 text-sm text-white/80">
            {resumeCourse
              ? `Reprends « ${resumeCourse.title} » là où tu t'es arrêté.`
              : "Décris un sujet, Tavyra en fait une vraie formation structurée."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {resumeCourse ? (
              <Link
                href={`/dashboard/formations/${resumeCourse.id}#chapitre-${resumeChapter}`}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#4c1d95] shadow-[0_10px_30px_-10px_rgba(20,5,50,0.6)] transition-transform hover:scale-[1.03]"
              >
                Continuer · chapitre {Math.min(resumeChapter, Math.max(resumeCourse.chapterCount - 1, 0)) + 1}/
                {resumeCourse.chapterCount}
              </Link>
            ) : null}
            <Link
              href="/dashboard/creer"
              className={
                resumeCourse
                  ? "inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/20"
                  : "inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#4c1d95] shadow-[0_10px_30px_-10px_rgba(20,5,50,0.6)] transition-transform hover:scale-[1.03]"
              }
            >
              + Nouvelle formation
            </Link>
            <Link
              href="/dashboard/formations"
              className="hidden items-center gap-2 rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/20 sm:inline-flex"
            >
              <IconLibrary width={15} height={15} />
              Bibliothèque
            </Link>
          </div>
        </div>
      </section>

      {recentCourses.length === 0 && (
        <TopicSuggestions className="rise mt-5" />
      )}

      <section className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="rise" style={{ ["--d" as string]: "80ms" }}>
          <StatCard
            icon={<IconGraduationCap width={20} height={20} />}
            gradient="from-brand-from via-brand-via to-brand-to"
            label="Formations"
            value={String(stats.totalCourses)}
            sublabel={`${stats.completedCourses} terminée${stats.completedCourses > 1 ? "s" : ""}`}
            trend={
              stats.coursesCreatedThisWeek > 0
                ? { direction: "up", text: `+${stats.coursesCreatedThisWeek} cette sem.` }
                : null
            }
            sparklineData={stats.courseCountSeries}
            sparklineColor="var(--accent-blue-light)"
          />
        </div>
        <div className="rise" style={{ ["--d" as string]: "150ms" }}>
          <StatCard
            icon={<IconTarget width={20} height={20} />}
            gradient="from-success to-success-light"
            label="Taux de réussite quiz"
            value={stats.avgQuizScorePercent !== null ? `${stats.avgQuizScorePercent}%` : "—"}
            sublabel={
              stats.quizzesCompleted > 0
                ? `${stats.quizzesCompleted} quiz complété${stats.quizzesCompleted > 1 ? "s" : ""}`
                : "Aucun quiz pour l'instant"
            }
            trend={
              stats.quizScoreTrend
                ? {
                    direction: stats.quizScoreTrend.deltaPoints >= 0 ? "up" : "down",
                    text: `${Math.abs(stats.quizScoreTrend.deltaPoints)} pts`,
                  }
                : null
            }
            sparklineData={stats.quizScoreSeries}
            sparklineColor="var(--success-light)"
          />
        </div>
        <div className="rise" style={{ ["--d" as string]: "220ms" }}>
          <StatCard
            icon={<IconChartLine width={20} height={20} />}
            gradient="from-accent-violet to-accent-violet-light"
            label="Contenu disponible"
            value={formatReadingTime(stats.estimatedReadingMinutesTotal)}
            sublabel="temps de lecture estimé"
          />
        </div>
        <div className="rise" style={{ ["--d" as string]: "290ms" }}>
          <StatCard
            icon={<IconFlame width={20} height={20} />}
            gradient="from-warning to-warning-light"
            label="Série active"
            value={`${stats.activeDayStreak} j`}
            sublabel="jours consécutifs"
            sparklineData={stats.activityByDay.slice(-7).map((d) => d.count)}
            sparklineColor="var(--warning-light)"
          />
        </div>
      </section>

      <section className="rise mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2" style={{ ["--d" as string]: "380ms" }}>
        <Card>
          <h2 className="text-sm font-semibold text-foreground">Progression globale</h2>
          <div className="mt-5">
            <ProgressRing
              percent={stats.avgProgressPercent}
              label="Avancement moyen"
              sublabel={
                stats.totalCourses > 0
                  ? `sur ${stats.totalCourses} formation${stats.totalCourses > 1 ? "s" : ""}`
                  : "Aucune formation pour l'instant"
              }
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

      <section
        className="rise mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[1.4fr_1fr]"
        style={{ ["--d" as string]: "460ms" }}
      >
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Formations récentes
            </h2>
            <Link
              href="/dashboard/formations"
              className="text-xs font-medium text-accent-violet-light hover:text-accent-violet"
            >
              Voir tout →
            </Link>
          </div>
          {recentCourses.length > 0 ? (
            <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {recentCourses.map((course) => (
                <CourseListItem key={course.id} course={course} />
              ))}
            </ul>
          ) : (
            <EmptyState
              className="mt-4"
              icon={<IconGraduationCap width={20} height={20} />}
              title="0 formation générée pour l'instant"
              description="Lance ta première génération — elle apparaîtra ici, prête à reprendre où tu veux."
              action={<Button href="/dashboard/creer">Créer ma première formation</Button>}
            />
          )}
        </div>

        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Activité récente
          </h2>
          <Card className="mt-4" padding="sm">
            <ActivityFeed events={stats.recentActivity} />
          </Card>
        </div>
      </section>

      {locked && (
        <section className="rise relative mt-10 overflow-hidden rounded-3xl border border-accent-violet/30 bg-background-card/80 p-6 sm:p-8">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-accent-violet/25 blur-3xl"
          />
          <div className="relative grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <span className="bg-brand inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                Plan Pro
              </span>
              <h2 className="mt-3 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                Débloque tes formations complètes
              </h2>
              <ul className="mt-4 grid gap-2.5 text-sm text-foreground sm:grid-cols-2">
                {PRO_PLAN_FEATURES.map((feature) => (
                  <li key={feature} className="flex gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-violet/20 text-[11px] text-accent-violet-light">
                      ✓
                    </span>
                    <span className="text-foreground-muted">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col items-start gap-2 md:items-center">
              <p className="text-3xl font-semibold tracking-tight text-foreground">
                {PRO_PLAN_PRICE_EUR.toFixed(2).replace(".", ",")} €
                <span className="text-sm font-normal text-foreground-muted"> / mois</span>
              </p>
              <Button href="/checkout" className="w-full md:w-auto">
                Passer au Pro →
              </Button>
              <p className="text-[11px] text-foreground-muted">
                Paiement sécurisé via Stripe · Résiliation en un clic
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
