import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { isOnFreePlan } from "@/lib/courses/plan";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../actions";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const onFreePlan = await isOnFreePlan(supabase, user.id).catch(() => true);
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
