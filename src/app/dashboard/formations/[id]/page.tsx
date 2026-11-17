import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BackgroundGlow } from "@/components/background-glow";
import { ChapterChat } from "@/components/chapter-chat";
import { CourseView } from "@/components/course-view";
import { computeCourseAccess, redactLockedCourseContent } from "@/lib/courses/access";
import { getCourseById } from "@/lib/courses/persist";
import { isOnFreePlan } from "@/lib/courses/plan";
import { createClient } from "@/lib/supabase/server";
import { ProgressTracker } from "./progress-tracker";

export default async function CourseDetailPage(
  props: PageProps<"/dashboard/formations/[id]">,
) {
  const { id } = await props.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Prompt 05.19/05.20 (optimisation) : les deux requêtes sont totalement
  // indépendantes (l'une lit la formation, l'autre l'abonnement) — aucune
  // raison de les enchaîner séquentiellement.
  const [course, locked] = await Promise.all([
    getCourseById(supabase, id),
    isOnFreePlan(supabase, user.id),
  ]);
  if (!course) {
    notFound();
  }

  const access = computeCourseAccess(course, locked);
  const maxChapterIndex = locked ? access.unlockedCount - 1 : undefined;

  // Prompt 05.17.2 (correction E1 de l'audit 05.17) : le contenu des
  // chapitres/quiz verrouillés pour le plan gratuit ne doit plus jamais
  // atteindre le navigateur, y compris via le payload serveur->client des
  // Server Components (ce que `locked`/le flou CSS de `CourseView` ne
  // protégeaient pas). La redaction est appliquée une seule fois ici, avant
  // transmission à TOUS les composants qui reçoivent `course` — un
  // utilisateur Pro (`locked === false`) reçoit la formation strictement
  // inchangée.
  const safeCourse = redactLockedCourseContent(course, locked);

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
        <CourseView course={safeCourse} courseId={id} locked={locked} />
      </main>

      <ChapterChat course={safeCourse} courseId={id} maxChapterIndex={maxChapterIndex} />
      <ProgressTracker courseId={id} maxChapterIndex={maxChapterIndex} />
    </div>
  );
}
