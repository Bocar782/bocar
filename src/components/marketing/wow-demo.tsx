"use client";

import { useMemo, useState } from "react";

type Preset = {
  keywords: string[];
  domain: string;
  level: string;
  title: string;
  chapters: string[];
  exampleTitle: string;
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
    exampleTitle: "Exemple concret",
    example:
      "Comment Shopify a aidé des milliers de créateurs à lancer leur boutique sans compétences techniques.",
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
    exampleTitle: "Exemple concret",
    example:
      "Comment Warren Buffett a construit Berkshire Hathaway en misant sur la valeur à long terme.",
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
    exampleTitle: "Exemple concret",
    example:
      "Comment Dollar Shave Club a conquis un marché dominé par Gillette avec une seule vidéo virale.",
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
    exampleTitle: "Exemple concret",
    example:
      "Comment la convocation des États généraux en 1789 a déclenché une dynamique que personne ne contrôlait plus.",
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
    exampleTitle: "Exemple concret",
    example:
      "Comment Einstein a reformulé notre compréhension du temps et de l'espace avec la relativité restreinte.",
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
    exampleTitle: "Exemple concret",
    example:
      "Comment Airbnb a validé son concept en louant des matelas gonflables avant de lever des millions.",
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
          <span className="ml-3 text-xs text-foreground-muted">dashboard.lia.app</span>
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
              Lia construit ta formation...
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

            <div className="mt-4 rounded-xl border border-l-4 border-border-subtle border-l-accent-blue/50 bg-white/[0.03] p-3">
              <span className="text-[11px] font-medium uppercase tracking-wide text-accent-blue-light">
                {preset.exampleTitle}
              </span>
              <p className="mt-1 text-xs leading-relaxed text-foreground-muted">{preset.example}</p>
            </div>

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
