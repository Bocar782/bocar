import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { IconChat, IconGraduationCap, IconTarget } from "@/components/marketing/icons";
import { getUsageStatuses, type UsageStatus } from "@/lib/courses/plan";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../actions";
import { GeneratorTabs } from "../generator-tabs";

const DEFAULT_USAGE = { isPro: false, used: 0, limit: 1, remaining: 1, resetsAt: null };

function formatResetDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

function UsagePill({ label, usage }: { label: string; usage: UsageStatus }) {
  const resetLabel = formatResetDate(usage.resetsAt);
  return (
    <div className="flex items-center gap-3 rounded-full border border-border-subtle bg-background-card/80 px-4 py-2 shadow-[0_8px_24px_-18px_var(--glow)]">
      <span className="text-xs font-medium text-foreground-muted">{label}</span>
      <span className="text-sm font-semibold text-foreground">
        {usage.remaining}/{usage.limit}
      </span>
      {resetLabel && (
        <span className="text-xs text-foreground-muted">renouvelé le {resetLabel}</span>
      )}
    </div>
  );
}

const HOW_IT_WORKS = [
  {
    icon: <IconChat width={18} height={18} />,
    title: "1. Diagnostic guidé",
    description: "Quelques questions adaptées à ton sujet pour cerner ton niveau réel.",
  },
  {
    icon: <IconTarget width={18} height={18} />,
    title: "2. Plan proposé",
    description: "Un programme de modules et de chapitres que tu peux ajuster avant de valider.",
  },
  {
    icon: <IconGraduationCap width={18} height={18} />,
    title: "3. Formation générée",
    description: "Chapitres, exemples, exercices et quiz prêts à être lus dans la foulée.",
  },
];

const MAX_PREFILLED_TOPIC_LENGTH = 120;

export default async function CreateCoursePage(props: PageProps<"/dashboard/creer">) {
  const searchParams = await props.searchParams;
  const rawTopic = searchParams?.sujet;
  const initialTopic = (Array.isArray(rawTopic) ? rawTopic[0] : rawTopic ?? "")
    .trim()
    .slice(0, MAX_PREFILLED_TOPIC_LENGTH);

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
        <span className="rise inline-flex items-center gap-2 rounded-full border border-accent-violet/30 bg-accent-violet/10 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-violet-light">
          <span className="bg-brand h-1.5 w-1.5 rounded-full" />
          Nouvelle formation
        </span>
        <h1 className="mt-4 text-center text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Que veux-tu apprendre aujourd&apos;hui ?
        </h1>
        <p className="mt-2 max-w-md text-center text-sm text-foreground-muted">
          {onFreePlan
            ? "Décris un sujet, réponds à un quiz de diagnostic gratuit et découvre le programme que Tavyra construirait pour toi."
            : "Décris un sujet, Tavyra construit ta formation complète — adaptée à ton niveau et à tes objectifs."}
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          <UsagePill label="Formations" usage={usage} />
          <UsagePill label="Analyses" usage={analysisUsage} />
        </div>

        <div className="mt-10 w-full">
          <GeneratorTabs
            courseRemainingGenerations={usage.remaining}
            courseLocked={onFreePlan}
            analysisRemainingGenerations={analysisUsage.remaining}
            analysisIsPro={analysisUsage.isPro}
            initialTopic={initialTopic}
          />
        </div>

        <section className="mt-14 w-full border-t border-border-subtle pt-10">
          <h2 className="text-center text-xs font-semibold uppercase tracking-wide text-foreground-muted">
            Comment ça marche
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {HOW_IT_WORKS.map((step) => (
              <div
                key={step.title}
                className="lift rounded-2xl border border-border-subtle bg-background-card/80 p-5"
              >
                <span className="bg-brand flex h-9 w-9 items-center justify-center rounded-lg text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]">
                  {step.icon}
                </span>
                <p className="mt-3 text-sm font-semibold text-foreground">{step.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-foreground-muted">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
