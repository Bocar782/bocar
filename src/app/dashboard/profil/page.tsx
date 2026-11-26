import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { IconChartLine, IconGraduationCap } from "@/components/marketing/icons";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getUsageStatuses, isOnFreePlan, type UsageStatus } from "@/lib/courses/plan";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../actions";

function UsageCard({
  icon,
  label,
  usage,
}: {
  icon: ReactNode;
  label: string;
  usage: UsageStatus;
}) {
  const percentUsed = usage.limit > 0 ? Math.round((usage.used / usage.limit) * 100) : 0;
  const resetLabel = usage.resetsAt
    ? new Date(usage.resetsAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })
    : null;
  return (
    <div className="rounded-2xl border border-border-subtle bg-background-card p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-violet-tint text-accent-violet">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-foreground-muted">
            {usage.used}/{usage.limit} utilisée{usage.used > 1 ? "s" : ""}
            {resetLabel ? ` · renouvelé le ${resetLabel}` : usage.isPro ? "" : " (à vie)"}
          </p>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-overlay/[0.06]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-from via-brand-via to-brand-to"
          style={{ width: `${Math.min(100, percentUsed)}%` }}
        />
      </div>
    </div>
  );
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [onFreePlan, usageStatuses] = await Promise.all([
    isOnFreePlan(supabase, user.id).catch(() => true),
    getUsageStatuses(supabase, user.id).catch(() => null),
  ]);
  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <DashboardShell userEmail={user.email ?? ""} isPro={!onFreePlan} onSignOut={signOut}>
      <div className="mx-auto w-full max-w-4xl">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Profil et abonnement
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Gère ton compte et ton abonnement Tavyra.
        </p>

        <Card className="mt-8">
          <h2 className="text-sm font-semibold text-foreground">Compte</h2>
          <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                Adresse email
              </dt>
              <dd className="mt-1 text-sm text-foreground">{user.email}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                Membre depuis
              </dt>
              <dd className="mt-1 text-sm text-foreground">{memberSince ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                Plan actuel
              </dt>
              <dd className="mt-1">
                <Badge tone={onFreePlan ? "neutral" : "accent"}>
                  {onFreePlan ? "Gratuit" : "Pro"}
                </Badge>
              </dd>
            </div>
          </dl>

          <form action={signOut} className="mt-6">
            <button
              type="submit"
              className="text-sm font-medium text-foreground-muted underline underline-offset-2 hover:text-foreground"
            >
              Se déconnecter
            </button>
          </form>
        </Card>

        {usageStatuses && (
          <div className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">
              Utilisation
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <UsageCard
                icon={<IconGraduationCap width={18} height={18} />}
                label="Formations"
                usage={usageStatuses.course}
              />
              <UsageCard
                icon={<IconChartLine width={18} height={18} />}
                label="Analyses approfondies"
                usage={usageStatuses.analysis}
              />
            </div>
          </div>
        )}

        <div className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">
            Thème
          </h2>
          <p className="mt-1 text-sm text-foreground-muted">
            Choisis l&apos;apparence de ton espace Tavyra — le choix est mémorisé sur cet appareil.
          </p>
          <div className="mt-4">
            <ThemeToggle />
          </div>
        </div>

        <div className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">
            Abonnement et facturation
          </h2>
          <div className="mt-4">
            <PricingCards user={user} onFreePlan={onFreePlan} />
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
