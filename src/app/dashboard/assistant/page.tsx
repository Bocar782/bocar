import Link from "next/link";
import { redirect } from "next/navigation";
import { AssistantChatPanel } from "@/components/dashboard/assistant-chat-panel";
import { CourseCover } from "@/components/dashboard/course-cover";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { IconChat, IconGraduationCap } from "@/components/marketing/icons";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { computeCourseAccess } from "@/lib/courses/access";
import { isOnFreePlan } from "@/lib/courses/plan";
import { getCourseById, listCourses } from "@/lib/courses/persist";
import { computeCourseProgress } from "@/lib/courses/progress";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../actions";

export default async function AssistantPage(props: PageProps<"/dashboard/assistant">) {
  const searchParams = await props.searchParams;
  const selectedCourseIdRaw = searchParams?.course;
  const selectedCourseId = Array.isArray(selectedCourseIdRaw)
    ? selectedCourseIdRaw[0]
    : selectedCourseIdRaw;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [courses, locked] = await Promise.all([
    listCourses(supabase, user.id).catch(() => []),
    isOnFreePlan(supabase, user.id).catch(() => true),
  ]);

  // `getCourseById` applique déjà la RLS "courses_owner_all" : une formation
  // qui n'appartient pas à cet utilisateur (ou un id invalide/inexistant)
  // renvoie `null`, exactement comme pour /dashboard/formations/[id].
  const selectedCourse =
    selectedCourseId && courses.some((c) => c.id === selectedCourseId)
      ? await getCourseById(supabase, selectedCourseId).catch(() => null)
      : null;

  const access = selectedCourse ? computeCourseAccess(selectedCourse, locked) : null;
  const chapters =
    selectedCourse && access
      ? selectedCourse.chapters.map((chapter) => ({
          position: chapter.position,
          title: chapter.title,
          locked: access.lockedChapterPositions.has(chapter.position),
        }))
      : [];
  const meta = selectedCourseId ? courses.find((c) => c.id === selectedCourseId) : undefined;
  const initialChapterIndex = (() => {
    if (!access || chapters.length === 0) return 0;
    const fromProgress = meta?.currentChapterIndex ?? 0;
    return Math.min(fromProgress, Math.max(access.unlockedCount - 1, 0));
  })();

  return (
    <DashboardShell userEmail={user.email ?? ""} isPro={!locked} onSignOut={signOut}>
      <div className="mx-auto w-full max-w-5xl">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Assistant
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">
          {courses.length > 0
            ? `${courses.length} formation${courses.length > 1 ? "s" : ""} disponible${courses.length > 1 ? "s" : ""} pour poser tes questions à Tavyra — les réponses tiennent compte du contenu réel de la formation choisie.`
            : "Choisis une formation pour poser tes questions à Tavyra — les réponses tiennent compte du contenu réel de la formation."}
        </p>

        {courses.length === 0 ? (
          <EmptyState
            className="mt-8"
            icon={<IconChat width={22} height={22} />}
            title="Aucune formation pour l'instant"
            description="Crée d'abord une formation pour pouvoir en discuter avec Tavyra."
            action={<Button href="/dashboard/creer">Créer ma première formation</Button>}
          />
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[19rem_1fr]">
            <div className="space-y-2">
              {courses.map((course) => {
                const active = course.id === selectedCourseId;
                const { percent } = computeCourseProgress(course);
                return (
                  <Link
                    key={course.id}
                    href={`/dashboard/assistant?course=${course.id}`}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-3 transition-colors ${
                      active
                        ? "border-accent-violet/40 bg-accent-violet/10"
                        : "border-border-subtle bg-background-card hover:border-overlay/20"
                    }`}
                  >
                    <CourseCover
                      seed={course.id}
                      icon={<IconGraduationCap width={16} height={16} />}
                      className="h-10 w-10 shrink-0"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {course.title}
                      </span>
                      <span className="block truncate text-xs text-foreground-muted">
                        {course.domain}
                      </span>
                    </span>
                    {percent > 0 && (
                      <span className="shrink-0 text-xs font-medium text-foreground-muted">
                        {percent}%
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>

            <div>
              {selectedCourse ? (
                <AssistantChatPanel
                  courseId={selectedCourseId!}
                  courseTitle={selectedCourse.title}
                  chapters={chapters}
                  initialChapterIndex={initialChapterIndex}
                />
              ) : (
                <EmptyState
                  className="flex h-full flex-col items-center justify-center"
                  icon={<IconChat width={22} height={22} />}
                  title="Choisis une formation"
                  description="Sélectionne une formation à gauche pour commencer à discuter avec Tavyra."
                />
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
