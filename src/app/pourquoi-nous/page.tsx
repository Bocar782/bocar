import Link from "next/link";
import { BackgroundGlow } from "@/components/background-glow";
import { SiteHeader } from "@/components/site-header";

const PROBLEMS = [
  {
    title: "L'information est partout, et nulle part",
    description:
      "Articles, vidéos, forums, threads : tout existe déjà sur presque tout sujet, mais dispersé, contradictoire, et rarement structuré pour apprendre dans l'ordre.",
  },
  {
    title: "Savoir quoi apprendre est déjà un problème",
    description:
      "Avant même de comprendre un sujet, il faut deviner par où commencer, quelles notions sont des prérequis, et ce qui est accessoire.",
  },
  {
    title: "Rien n'est adapté à toi",
    description:
      "Un même article s'adresse à tout le monde — débutant ou expert — alors que ce qu'il te faut dépend de ton niveau, de ton rythme et de tes objectifs.",
  },
];

export default function WhyWeExistPage() {
  return (
    <div className="relative flex min-h-screen flex-1 flex-col">
      <BackgroundGlow />
      <SiteHeader />

      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 pb-32 pt-12 sm:pt-20">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-violet-light">
          Notre mission
        </span>
        <h1 className="mt-3 text-balance text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
          Pourquoi nous existons
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-foreground-muted">
          Tavyra n&apos;est pas né d&apos;une envie de faire « encore un outil
          IA ». Il est né d&apos;un constat simple : apprendre un nouveau
          sujet aujourd&apos;hui est inutilement difficile — pas par manque
          d&apos;information, mais par excès.
        </p>

        <section className="mt-16">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Le problème de l&apos;apprentissage traditionnel
          </h2>
          <div className="mt-8 space-y-6">
            {PROBLEMS.map((problem) => (
              <div
                key={problem.title}
                className="rounded-2xl border border-border-subtle bg-white/[0.02] p-6"
              >
                <h3 className="text-base font-semibold text-foreground">{problem.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
                  {problem.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Notre vision : l&apos;apprentissage assisté par IA
          </h2>
          <div className="mt-6 space-y-4 text-base leading-relaxed text-foreground-muted">
            <p>
              Nous pensons que l&apos;IA ne devrait pas se contenter de
              répondre à des questions isolées : elle peut construire, pour
              chaque personne et chaque sujet, un vrai parcours
              d&apos;apprentissage — avec une progression logique, des
              exemples concrets ancrés dans le réel, et une façon de
              vérifier ce qu&apos;on a vraiment compris.
            </p>
            <p>
              C&apos;est la différence entre poser une question à un
              chatbot et suivre une formation : l&apos;un donne une
              réponse, l&apos;autre construit une compréhension.
            </p>
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Pourquoi ce produit a été créé
          </h2>
          <div className="mt-6 space-y-4 text-base leading-relaxed text-foreground-muted">
            <p>
              Tavyra a été créé pour rendre ce type de parcours accessible à
              n&apos;importe qui, sur n&apos;importe quel sujet, en quelques
              minutes plutôt qu&apos;en plusieurs heures de recherche et de
              tri. Pas pour remplacer les bons livres, les bons cours ou les
              bons enseignants — mais pour combler ce qui manque entre
              « je ne sais pas par où commencer » et « j&apos;ai enfin
              compris ».
            </p>
          </div>
        </section>

        <div className="mt-20 flex justify-center">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-accent-blue to-accent-violet px-7 py-3.5 text-sm font-semibold text-white shadow-[0_8px_30px_-8px_var(--accent-violet)] transition-all hover:brightness-110"
          >
            Créer ma première formation →
          </Link>
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
