import Link from "next/link";
import { BackgroundGlow } from "@/components/background-glow";
import { SiteHeader } from "@/components/site-header";
import { PRO_PLAN_PRICE_EUR } from "@/lib/courses/plan";

/**
 * Page intérimaire (Prompt 05.13) : remplace le lien mort "#" du footer de
 * la landing. Ce n'est PAS des conditions d'utilisation juridiquement
 * complètes ni conformes — l'identité légale de l'éditeur et la
 * juridiction applicable ne sont pas encore définies, et rien de tout cela
 * n'est inventé ici. Décrit uniquement le fonctionnement réel du service
 * (vérifié dans le code à la date d'écriture) ; voir le dernier encadré
 * pour ce qui reste à compléter avant une vraie page juridique.
 */
export default function TermsPage() {
  return (
    <div className="relative flex min-h-screen flex-1 flex-col">
      <BackgroundGlow />
      <SiteHeader />

      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 pb-32 pt-12 sm:pt-20">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-violet-light">
          Transparence
        </span>
        <h1 className="mt-3 text-balance text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
          Conditions d&apos;utilisation
        </h1>

        <p className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-300">
          Cette page ne constitue pas encore des conditions
          d&apos;utilisation complètes et juridiquement finalisées. En
          attendant leur version définitive, elle décrit honnêtement le
          fonctionnement réel du service.
        </p>

        <div className="mt-12 space-y-10">
          <section>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Le service
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-foreground-muted">
              Tavyra génère, à partir d&apos;un sujet que tu décris, une
              formation structurée (chapitres, exemples, quiz) et, sur le
              plan Pro, une analyse approfondie — à l&apos;aide d&apos;un
              modèle d&apos;IA (Claude, d&apos;Anthropic).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Ton compte
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-foreground-muted">
              Un compte est nécessaire pour générer et retrouver tes
              formations. Tu es responsable de la confidentialité de ton
              mot de passe.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Contenu généré par IA
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-foreground-muted">
              <li>Le contenu est généré automatiquement et peut contenir des erreurs.</li>
              <li>
                Un exemple non vérifié est toujours présenté comme
                fictif/illustratif plutôt que réel — jamais comme un fait
                vérifié s&apos;il ne l&apos;est pas.
              </li>
              <li>Vérifie toute information avant de t&apos;en servir pour une décision importante.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Abonnement Pro
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-foreground-muted">
              Le plan Pro est un abonnement de {PRO_PLAN_PRICE_EUR.toFixed(2).replace(".", ",")}€/mois,
              géré par Stripe, résiliable à tout moment depuis le portail
              d&apos;abonnement accessible dans ton tableau de bord.
            </p>
          </section>

          <section className="rounded-2xl border border-border-subtle bg-white/[0.02] p-6">
            <h2 className="text-base font-semibold text-foreground">
              Ce qu&apos;il reste à préciser
            </h2>
            <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-foreground-muted">
              <li>L&apos;identité légale de l&apos;éditeur de Tavyra et la juridiction applicable.</li>
              <li>Les modalités précises de résiliation et de remboursement, au-delà de ce que gère déjà Stripe.</li>
              <li>Les conditions d&apos;usage acceptable du contenu généré.</li>
            </ul>
            <p className="mt-3 text-sm leading-relaxed text-foreground-muted">
              Ces éléments seront ajoutés dès que l&apos;identité légale de
              l&apos;éditeur sera finalisée.
            </p>
          </section>
        </div>
      </main>

      <footer className="relative z-10 border-t border-border-subtle">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-xs text-foreground-muted sm:flex-row">
          <span>© {new Date().getFullYear()} Tavyra. Tous droits réservés.</span>
          <Link href="/" className="transition-colors hover:text-foreground">
            ← Retour à l&apos;accueil
          </Link>
        </div>
      </footer>
    </div>
  );
}
