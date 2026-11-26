"use client";

import { useMemo, useState } from "react";

type Preset = {
  keywords: string[];
  domain: string;
  level: string;
  title: string;
  chapters: string[];
  example: string;
  quizQuestion: string;
  quizChoices: [string, string];
};

const PRESETS: Preset[] = [
  {
    keywords: ["e-commerce", "ecommerce", "boutique", "shopify"],
    domain: "e-commerce",
    level: "débutant",
    title: "Créer sa boutique en ligne, de l'idée au premier client",
    chapters: [
      "Choisir sa niche et valider son marché",
      "Créer sa boutique et son catalogue produits",
      "Acquisition : SEO, publicité et réseaux sociaux",
      "Logistique, paiement et service client",
    ],
    example:
      "Avant de choisir ton produit, commence par identifier un problème réel que rencontrent les gens — Shopify a ainsi permis à des milliers de créateurs sans aucune compétence technique de lancer leur boutique en quelques semaines. L'essentiel n'est pas la plateforme, mais la clarté de ton offre et la confiance que tu inspires dès la première visite.",
    quizQuestion: "Quel indicateur mesure le taux de visiteurs qui achètent ?",
    quizChoices: ["Trafic", "Taux de conversion"],
  },
  {
    keywords: ["finance", "investir", "bourse", "marché", "épargne", "argent"],
    domain: "finance",
    level: "débutant",
    title: "Comprendre les marchés financiers, des bases aux stratégies",
    chapters: [
      "Comprendre les actions, obligations et ETF",
      "Lire un bilan et évaluer une entreprise",
      "Construire un portefeuille diversifié",
      "Gérer le risque et les biais émotionnels",
    ],
    example:
      "Warren Buffett n'a jamais cherché à deviner les mouvements du marché : il achetait des entreprises solides à un prix inférieur à leur valeur réelle, puis attendait. Cette discipline, tenue sur des décennies, a transformé Berkshire Hathaway en l'une des plus grandes réussites financières de l'histoire.",
    quizQuestion: "Que signifie « diversifier » un portefeuille ?",
    quizChoices: ["Investir dans une seule action", "Répartir ses investissements"],
  },
  {
    keywords: ["marketing", "publicité", "pub", "ads", "réseaux sociaux"],
    domain: "marketing",
    level: "débutant",
    title: "Maîtriser la publicité en ligne, de la stratégie aux campagnes",
    chapters: [
      "Définir sa cible et son message",
      "Choisir les bons canaux (SEO, social, ads)",
      "Créer une campagne publicitaire efficace",
      "Mesurer et optimiser ses résultats",
    ],
    example:
      "Dollar Shave Club n'avait ni le budget ni la notoriété de Gillette — seulement une vidéo de 90 secondes, tournée pour quelques centaines de dollars, qui parlait directement à sa cible avec humour et honnêteté. Elle a généré 12 000 commandes en 48 heures et changé la façon dont les marques pensent la publicité.",
    quizQuestion: "Que mesure le CPA en publicité ?",
    quizChoices: ["Le nombre de clics", "Le coût par acquisition"],
  },
  {
    keywords: ["histoire", "révolution", "rome", "empire", "guerre", "antiquité"],
    domain: "histoire",
    level: "débutant",
    title: "Comprendre la Révolution française, des causes aux conséquences",
    chapters: [
      "Les causes profondes de la crise de l'Ancien Régime",
      "1789 : la prise de la Bastille et la fin des privilèges",
      "La Terreur et la radicalisation révolutionnaire",
      "L'héritage politique de la Révolution",
    ],
    example:
      "Quand Louis XVI convoque les États généraux en 1789 pour résoudre la crise financière du royaume, il espère calmer la contestation — il va en réalité déclencher une dynamique que plus personne ne contrôlera. En quelques semaines, la contestation fiscale devient une remise en cause totale de l'Ancien Régime.",
    quizQuestion: "Que sont les États généraux ?",
    quizChoices: ["Une armée royale", "Une assemblée des trois ordres"],
  },
  {
    keywords: ["physique", "science", "chimie", "quantique", "relativité"],
    domain: "sciences",
    level: "débutant",
    title: "Comprendre la physique, des lois de Newton à la relativité",
    chapters: [
      "Les lois du mouvement de Newton",
      "Énergie, travail et puissance",
      "Électricité et magnétisme",
      "Introduction à la relativité d'Einstein",
    ],
    example:
      "Einstein a posé une question simple en apparence : et si la vitesse de la lumière était la même pour tout observateur, peu importe sa propre vitesse ? En poussant cette idée jusqu'au bout, il a dû renoncer à l'idée d'un temps absolu — une rupture qui a redéfini notre compréhension de l'univers.",
    quizQuestion: "Que décrit la deuxième loi de Newton ?",
    quizChoices: ["E = mc²", "F = m × a"],
  },
  {
    keywords: ["entreprise", "business", "entrepreneur", "startup", "société"],
    domain: "business",
    level: "débutant",
    title: "Créer son entreprise, de l'idée au premier euro",
    chapters: [
      "Valider son idée et son marché",
      "Choisir sa structure juridique",
      "Construire son plan de financement",
      "Trouver ses premiers clients",
    ],
    example:
      "Airbnb n'a pas commencé par lever des millions — ses fondateurs ont loué des matelas gonflables dans leur propre appartement pour payer leur loyer, et ont découvert que des inconnus étaient prêts à payer pour un logement chez l'habitant. Cette validation à petite échelle, presque gratuite, a précédé toute la suite.",
    quizQuestion: "Qu'est-ce qu'un MVP ?",
    quizChoices: ["Un plan marketing complet", "Un produit minimum viable"],
  },
];

const DEFAULT_PRESET = PRESETS[0];
const DEFAULT_TOPIC = "Génère-moi une formation sur le e-commerce";
const SUGGESTIONS = ["la finance", "le marketing digital", "l'histoire", "la physique", "créer mon entreprise"];

function matchPreset(topic: string): Preset {
  const lower = topic.toLowerCase();
  const match = PRESETS.find((preset) => preset.keywords.some((kw) => lower.includes(kw)));
  return match ?? DEFAULT_PRESET;
}

export function WowDemo() {
  const [topic, setTopic] = useState("");
  const preset = useMemo(() => matchPreset(topic), [topic]);
  const displayText = topic.trim().length > 0 ? `Génère-moi une formation sur ${topic}` : DEFAULT_TOPIC;

  return (
    <div className="relative mx-auto w-full max-w-4xl">
      <div
        aria-hidden
        className="absolute -inset-4 -z-10 rounded-[40px] bg-gradient-to-br from-accent-blue/20 via-transparent to-accent-violet/20 blur-2xl"
      />
      <div className="overflow-hidden rounded-[28px] border border-border-subtle bg-background-elevated/80 shadow-[0_40px_120px_-40px_rgba(76,124,243,0.35)] backdrop-blur-xl">
        {/* Barre de fenêtre, pour ancrer visuellement "produit réel" */}
        <div className="flex items-center gap-1.5 border-b border-border-subtle px-5 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
          <span className="ml-3 text-xs text-foreground-muted">dashboard.tavyra.app</span>
        </div>

        <div className="grid gap-0 p-5 sm:p-8 md:grid-cols-2 md:gap-8">
          {/* Côté gauche : essaie avec ton propre sujet */}
          <div className="flex flex-col justify-center">
            <span className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
              Toi
            </span>
            <p className="typing-caret mt-3 text-xl font-medium leading-snug text-foreground sm:text-2xl">
              {displayText}
            </p>

            <input
              type="text"
              value={topic}
              onChange={(event) => setTopic(event.target.value.slice(0, 60))}
              placeholder="Tape ton propre sujet ici..."
              className="mt-5 w-full rounded-xl border border-border-subtle bg-white/[0.03] px-4 py-2.5 text-sm text-foreground placeholder:text-foreground-muted/60 focus:border-accent-violet/50 focus:outline-none"
            />

            <div className="mt-3 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setTopic(suggestion)}
                  className="rounded-full border border-border-subtle bg-white/[0.02] px-3 py-1 text-xs text-foreground-muted transition-colors hover:border-white/20 hover:text-foreground"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            <div className="mt-6 flex items-center gap-2 text-sm text-accent-violet-light">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-violet opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-violet" />
              </span>
              Tavyra construit ta formation...
            </div>
          </div>

          {/* Côté droit : aperçu de la formation générée, qui s'adapte au sujet tapé */}
          <div
            key={preset.domain}
            className="preset-fade rounded-2xl border border-border-subtle bg-white/[0.02] p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs text-foreground-muted">
              <span className="rounded-full border border-border-subtle bg-white/[0.03] px-2.5 py-1">
                {preset.domain}
              </span>
              <span className="rounded-full border border-border-subtle bg-white/[0.03] px-2.5 py-1">
                Niveau {preset.level}
              </span>
            </div>
            <h3 className="mt-3 text-lg font-semibold tracking-tight text-foreground">
              {preset.title}
            </h3>

            <ul className="mt-4 space-y-2.5">
              {preset.chapters.map((chapter, i) => (
                <li key={chapter} className="flex items-start gap-2.5 text-sm">
                  <span
                    className={
                      i < 2
                        ? "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-blue to-accent-violet text-[10px] text-white"
                        : "mt-0.5 h-4 w-4 shrink-0 rounded-full border border-border-subtle"
                    }
                  >
                    {i < 2 ? "✓" : ""}
                  </span>
                  <span className={i < 2 ? "text-foreground" : "text-foreground-muted"}>
                    {chapter}
                  </span>
                </li>
              ))}
            </ul>
            {/* Prompt 06.41 (retour utilisateur réel : la démo donnait
                l'impression qu'une formation = 4 titres + 2 phrases) :
                précise ce que contient RÉELLEMENT chaque leçon, jamais
                visible dans cette simple liste de titres. */}
            <p className="mt-2 text-[11px] text-foreground-muted">
              + explications détaillées, exemples vérifiés et exercices pour chaque leçon
            </p>

            {/* Présenté comme un EXTRAIT d'une leçon bien plus longue (effet
                de fondu en bas + mention explicite "la leçon continue"),
                jamais comme la totalité du contenu de cette leçon. */}
            <div className="relative mt-4 overflow-hidden rounded-xl border border-l-4 border-border-subtle border-l-accent-blue/50 bg-white/[0.03] p-3">
              <span className="text-[11px] font-medium uppercase tracking-wide text-accent-blue-light">
                Extrait — {preset.chapters[1]}
              </span>
              <p className="mt-1 text-xs leading-relaxed text-foreground-muted">{preset.example}</p>
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-background-elevated to-transparent"
              />
            </div>
            <p className="mt-1.5 text-[11px] italic text-foreground-muted/70">
              La leçon continue — explication complète, puis exercice pratique
            </p>

            <div className="mt-4 rounded-xl border border-accent-violet/25 bg-accent-violet/[0.08] p-3">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-accent-violet-light">
                Quiz · Question 3/10
              </span>
              <p className="mt-1.5 text-xs text-foreground">{preset.quizQuestion}</p>
              <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]">
                <span className="rounded-lg border border-border-subtle bg-white/[0.02] px-2 py-1.5 text-foreground-muted">
                  {preset.quizChoices[0]}
                </span>
                <span className="rounded-lg border border-accent-violet/40 bg-accent-violet/15 px-2 py-1.5 text-accent-violet-light">
                  {preset.quizChoices[1]} ✓
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
