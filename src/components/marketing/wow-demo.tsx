"use client";

import { useEffect, useState } from "react";
import { GenerationProgress } from "@/components/generation-progress";
import { STAGE_LABELS, type GenerationStage } from "@/lib/courses/schemas";

// Prompt 06.41 (demande explicite : remplacer l'aperçu d'un extrait de
// formation par le VRAI déroulé de génération) : mêmes étapes, mêmes
// libellés que `GenerationProgress` (réutilisé tel quel, voir
// src/components/generation-progress.tsx) — ce que montre cette démo est
// donc exactement ce qui se passe réellement lors d'une génération, jamais
// une mise en scène distincte qui pourrait diverger du produit réel.
const DEMO_STAGE_ORDER: GenerationStage[] = [
  "analyse",
  "recherche",
  "programme",
  "chapitres",
  "finition",
  "quizFinal",
  "assemblage",
  "pret",
];
const DEMO_STEP_MS = 1100;
// Pause un peu plus longue sur "Formation prête." avant de relancer la
// boucle, pour laisser le temps de lire l'état final.
const DEMO_PAUSE_ON_READY_MS = 2200;

const DEFAULT_TOPIC = "Génère-moi une formation sur le e-commerce";
const SUGGESTIONS = ["la finance", "le marketing digital", "l'histoire", "la physique", "créer mon entreprise"];

export function WowDemo() {
  const [topic, setTopic] = useState("");
  const [stageIndex, setStageIndex] = useState(0);
  const displayText = topic.trim().length > 0 ? `Génère-moi une formation sur ${topic}` : DEFAULT_TOPIC;

  useEffect(() => {
    const isLastStage = stageIndex >= DEMO_STAGE_ORDER.length - 1;
    const timer = setTimeout(
      () => setStageIndex((i) => (i >= DEMO_STAGE_ORDER.length - 1 ? 0 : i + 1)),
      isLastStage ? DEMO_PAUSE_ON_READY_MS : DEMO_STEP_MS,
    );
    return () => clearTimeout(timer);
  }, [stageIndex]);

  return (
    <div className="relative mx-auto w-full max-w-4xl">
      <div
        aria-hidden
        className="absolute -inset-6 -z-10 rounded-[40px] bg-gradient-to-br from-accent-violet/30 via-transparent to-[#d946ef]/20 blur-3xl"
      />
      <div className="glass-solid gradient-border overflow-hidden rounded-[28px]">
        {/* Barre de fenêtre, pour ancrer visuellement "produit réel" */}
        <div className="flex items-center gap-1.5 border-b border-border-subtle px-5 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]/70" />
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

          {/* Côté droit : le vrai déroulé de génération (composant réel,
              voir ci-dessus), qui boucle pour rester une démo vivante. */}
          <div className="flex items-center">
            <GenerationProgress
              currentStage={DEMO_STAGE_ORDER[stageIndex]}
              stageOrder={DEMO_STAGE_ORDER}
              stageLabels={STAGE_LABELS}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
