import Link from "next/link";
import { BackgroundGlow } from "@/components/background-glow";
import { SiteHeader } from "@/components/site-header";

/**
 * Page intérimaire (Prompt 05.13) : remplace le lien mort "#" du footer de
 * la landing. Ce n'est PAS une politique de confidentialité juridiquement
 * complète ni conforme — l'identité légale de l'éditeur, les durées de
 * conservation et la procédure d'exercice des droits ne sont pas encore
 * définies, et rien de tout cela n'est inventé ici. Cette page décrit
 * uniquement, en toute transparence, ce que le code du projet traite
 * réellement aujourd'hui (vérifié à la date d'écriture) ; voir le dernier
 * encadré pour ce qui reste à compléter avant une vraie page juridique.
 */
export default function PrivacyPage() {
  return (
    <div className="relative flex min-h-screen flex-1 flex-col">
      <BackgroundGlow />
      <SiteHeader />

      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 pb-32 pt-12 sm:pt-20">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-violet-light">
          Transparence
        </span>
        <h1 className="mt-3 text-balance text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
          Confidentialité
        </h1>

        <p className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-300">
          Cette page n&apos;est pas encore une politique de confidentialité
          complète et juridiquement finalisée. En attendant sa version
          définitive, elle décrit honnêtement ce que Tavyra traite
          réellement aujourd&apos;hui.
        </p>

        <div className="mt-12 space-y-10">
          <section>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Ce que nous collectons
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-foreground-muted">
              <li>
                Ton email et ton mot de passe à l&apos;inscription — gérés
                par Supabase Auth, jamais stockés en clair par notre code.
              </li>
              <li>Les sujets de formation que tu demandes, et les formations générées.</li>
              <li>Les messages que tu échanges avec l&apos;assistant pendant la lecture d&apos;une formation.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Où c&apos;est stocké
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-foreground-muted">
              Supabase (base de données et authentification) héberge
              l&apos;ensemble de ces données.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Génération par IA
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-foreground-muted">
              <li>
                Le sujet que tu décris et tes messages de chat sont transmis
                à l&apos;API Anthropic (Claude) pour générer ta formation et
                répondre à tes questions.
              </li>
              <li>
                Pour certains sujets, Anthropic effectue des recherches web
                afin de vérifier des exemples réels avant de les utiliser.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Paiement
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-foreground-muted">
              <li>Si tu t&apos;abonnes au plan Pro, ton email est transmis à Stripe pour créer ton compte client.</li>
              <li>
                Tes informations de carte bancaire sont saisies directement
                sur les pages sécurisées de Stripe : elles ne transitent
                jamais par nos serveurs.
              </li>
              <li>Nous conservons uniquement ton identifiant client Stripe et le statut de ton abonnement.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Cookies
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-foreground-muted">
              <li>Uniquement les cookies nécessaires pour te garder connecté(e) (session d&apos;authentification).</li>
              <li>Aucun outil de mesure d&apos;audience ni de publicité n&apos;est utilisé aujourd&apos;hui.</li>
            </ul>
          </section>

          <section className="rounded-2xl border border-border-subtle bg-white/[0.02] p-6">
            <h2 className="text-base font-semibold text-foreground">
              Ce qu&apos;il reste à préciser
            </h2>
            <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-foreground-muted">
              <li>Les durées de conservation exactes de ces données.</li>
              <li>La procédure formelle pour exercer tes droits (accès, suppression...).</li>
              <li>Les coordonnées de contact dédiées à ces questions.</li>
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
