import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getUsageStatuses } from "@/lib/courses/plan";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../actions";
import { GeneratorTabs } from "../generator-tabs";

const DEFAULT_USAGE = { isPro: false, used: 0, limit: 1, remaining: 1, resetsAt: null };

export default async function CreateCoursePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { course: usage, analysis: analysisUsage } = await getUsageStatuses(
    supabase,
    user.id,
  ).catch(() => ({
    course: DEFAULT_USAGE,
    analysis: { ...DEFAULT_USAGE, limit: 0, remaining: 0 },
  }));

  const onFreePlan = !usage.isPro;

  return (
    <DashboardShell userEmail={user.email ?? ""} isPro={!onFreePlan} onSignOut={signOut}>
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center">
        <h1 className="text-center text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Que veux-tu apprendre aujourd&apos;hui ?
        </h1>
        <p className="mt-2 max-w-md text-center text-sm text-foreground-muted">
          Décris un sujet, Tavyra construit ta formation complète — adaptée à ton niveau et à
          tes objectifs.
        </p>

        <div className="mt-10 w-full">
          <GeneratorTabs
            courseRemainingGenerations={usage.remaining}
            courseLocked={onFreePlan}
            analysisRemainingGenerations={analysisUsage.remaining}
            analysisIsPro={analysisUsage.isPro}
          />
        </div>
      </div>
    </DashboardShell>
  );
}
