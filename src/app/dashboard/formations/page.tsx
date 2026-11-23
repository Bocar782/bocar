import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { LibraryBrowser } from "@/components/dashboard/library-browser";
import { listDeepAnalyses } from "@/lib/analysis/persist";
import { isOnFreePlan } from "@/lib/courses/plan";
import { listCourses } from "@/lib/courses/persist";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../actions";

export default async function LibraryPage() {
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

  return (
    <DashboardShell userEmail={user.email ?? ""} isPro={!locked} onSignOut={signOut}>
      <div className="mx-auto w-full max-w-5xl">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Bibliothèque
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Toutes tes formations et analyses, au même endroit.
        </p>

        <div className="mt-8">
          <LibraryBrowser courses={courses} analyses={analyses} />
        </div>
      </div>
    </DashboardShell>
  );
}
