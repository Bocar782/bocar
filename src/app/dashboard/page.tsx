import Link from "next/link";
import { redirect } from "next/navigation";
import { BackgroundGlow } from "@/components/background-glow";
import { listCourses } from "@/lib/courses/persist";
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

  // Si la migration SQL n'a pas encore été appliquée côté Supabase, ne pas
  // faire planter tout le dashboard : l'utilisateur voit juste une liste vide.
  const courses = await listCourses(supabase, user.id).catch(() => []);

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
          <CourseGenerator />
        </div>

        {courses.length > 0 && (
          <section className="mt-16 w-full max-w-2xl">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">
              Tes formations
            </h2>
            <ul className="mt-4 space-y-2">
              {courses.map((course) => (
                <li key={course.id}>
                  <Link
                    href={`/dashboard/formations/${course.id}`}
                    className="flex items-center justify-between rounded-xl border border-border-subtle bg-white/[0.02] px-4 py-3 text-sm transition-colors hover:bg-white/[0.05]"
                  >
                    <span className="font-medium text-foreground">{course.title}</span>
                    <span className="text-xs text-foreground-muted">
                      {course.domain} · niveau {course.level}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
