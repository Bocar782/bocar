import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { IconCreditCard, IconLock, IconMail, IconUser } from "@/components/dashboard/icons";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { StripeSubmitForm } from "@/components/marketing/stripe-submit-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isOnFreePlan } from "@/lib/courses/plan";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../actions";
import { EmailForm, PasswordForm, UsernameForm } from "./settings-forms";

function SettingsSection({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="mt-6">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-violet-tint text-accent-violet">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="mt-0.5 text-xs text-foreground-muted">{description}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </Card>
  );
}

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const onFreePlan = await isOnFreePlan(supabase, user.id).catch(() => true);
  const currentUsername =
    typeof user.user_metadata?.username === "string" ? user.user_metadata.username : "";

  return (
    <DashboardShell userEmail={user.email ?? ""} isPro={!onFreePlan} onSignOut={signOut}>
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Paramètres
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Gère ton identifiant, ton accès et ta facturation.
        </p>

        <SettingsSection
          icon={<IconUser width={18} height={18} />}
          title="Nom d'utilisateur"
          description="Affiché dans l'app — n'a aucun impact sur ta connexion."
        >
          <UsernameForm currentUsername={currentUsername} />
        </SettingsSection>

        <SettingsSection
          icon={<IconMail width={18} height={18} />}
          title="Adresse email"
          description="Utilisée pour te connecter et recevoir les notifications importantes."
        >
          <EmailForm currentEmail={user.email ?? ""} />
        </SettingsSection>

        <SettingsSection
          icon={<IconLock width={18} height={18} />}
          title="Mot de passe"
          description="Choisis un mot de passe d'au moins 8 caractères."
        >
          <PasswordForm />
        </SettingsSection>

        <SettingsSection
          icon={<IconCreditCard width={18} height={18} />}
          title="Moyen de paiement et facturation"
          description="Géré directement par Stripe — Tavyra ne stocke jamais ton numéro de carte."
        >
          {onFreePlan ? (
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Badge tone="neutral">Plan gratuit</Badge>
                <p className="mt-2 text-sm text-foreground-muted">
                  Aucun moyen de paiement enregistré. Passe au plan Pro pour en ajouter un.
                </p>
              </div>
              <Button href="/pricing" variant="secondary">
                Voir les plans
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Badge tone="accent">Plan Pro</Badge>
                <p className="mt-2 text-sm text-foreground-muted">
                  Carte bancaire, factures et résiliation : tout se gère depuis le portail Stripe
                  sécurisé.
                </p>
              </div>
              <StripeSubmitForm action="/api/stripe/portal" variant="secondary">
                Gérer ma carte et mes factures
              </StripeSubmitForm>
            </div>
          )}
        </SettingsSection>

        <SettingsSection
          icon={<IconUser width={18} height={18} />}
          title="Thème"
          description="Choisis l'apparence de ton espace Tavyra — le choix est mémorisé sur cet appareil."
        >
          <ThemeToggle />
        </SettingsSection>
      </div>
    </DashboardShell>
  );
}
