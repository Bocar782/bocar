import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BackgroundGlow } from "@/components/background-glow";
import { ChapterChat } from "@/components/chapter-chat";
import { CourseView } from "@/components/course-view";
import { getCourseById } from "@/lib/courses/persist";
import { FREE_PLAN_UNLOCKED_CHAPTERS, isOnFreePlan } from "@/lib/courses/plan";
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

  const course = await getCourseById(supabase, id);
  if (!course) {
    notFound();
  }

  const locked = await isOnFreePlan(supabase, user.id);
  const maxChapterIndex = locked ? FREE_PLAN_UNLOCKED_CHAPTERS - 1 : undefined;

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
        <CourseView course={course} courseId={id} locked={locked} />
      </main>

      <ChapterChat course={course} maxChapterIndex={maxChapterIndex} />
      <ProgressTracker courseId={id} maxChapterIndex={maxChapterIndex} />
    </div>
  );
}
