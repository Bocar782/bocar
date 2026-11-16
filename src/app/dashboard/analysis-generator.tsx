"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { DeepAnalysisView } from "@/components/deep-analysis-view";
import { GenerationProgress } from "@/components/generation-progress";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { DEEP_STAGE_LABELS, type DeepAnalysisStage, type GeneratedDeepAnalysis } from "@/lib/analysis/schemas";

const STAGE_ORDER: DeepAnalysisStage[] = [
  "cadrage",
  "recherche",
  "redaction",
  "synthese",
  "pret",
];

type Status = "idle" | "generating" | "done" | "error";

type StreamEvent = {
  stage: DeepAnalysisStage | "done" | "error";
  label?: string;
  analysis?: GeneratedDeepAnalysis;
  analysisId?: string | null;
  message?: string;
  saveWarning?: string | null;
};

const MAX_LENGTH = 500;

export function AnalysisGenerator({
  remainingGenerations,
  isPro,
}: {
  remainingGenerations: number;
  isPro: boolean;
}) {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [stage, setStage] = useState<DeepAnalysisStage>("cadrage");
  const [analysis, setAnalysis] = useState<GeneratedDeepAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function resizeTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }

  async function handleSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const trimmed = topic.trim();
    if (!trimmed || status === "generating") return;

    setStatus("generating");
    setStage("cadrage");
    setError(null);
    setAnalysis(null);

    try {
      const response = await fetch("/api/analysis/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: trimmed }),
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Impossible de lancer l'analyse.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex = buffer.indexOf("\n");
        while (newlineIndex >= 0) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          newlineIndex = buffer.indexOf("\n");
          if (!line) continue;

          const parsed = JSON.parse(line) as StreamEvent;

          if (parsed.stage === "error") {
            throw new Error(parsed.message ?? "L'analyse a échoué.");
          }
          if (parsed.stage === "done" && parsed.analysis) {
            setAnalysis(parsed.analysis);
            setSaveWarning(parsed.saveWarning ?? null);
            setStatus("done");
            router.refresh();
            continue;
          }
          setStage(parsed.stage as DeepAnalysisStage);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setStatus("error");
    }
  }

  function startOver() {
    setStatus("idle");
    setTopic("");
    setAnalysis(null);
    setError(null);
  }

  if (status === "done" && analysis) {
    return (
      <div className="flex w-full flex-col items-center">
        {saveWarning && (
          <Callout tone="warning" className="mb-6 max-w-2xl text-center">
            Ton analyse est prête mais n&apos;a pas pu être sauvegardée ({saveWarning}). Elle ne sera pas visible après avoir quitté cette page.
          </Callout>
        )}
        <DeepAnalysisView analysis={analysis} />
        <Button type="button" variant="secondary" onClick={startOver} className="mt-8">
          Lancer une autre analyse
        </Button>
      </div>
    );
  }

  if (status === "generating") {
    return (
      <div className="flex w-full flex-col items-center py-16">
        <GenerationProgress
          currentStage={stage}
          stageOrder={STAGE_ORDER}
          stageLabels={DEEP_STAGE_LABELS}
        />
        <p className="mt-6 max-w-sm text-center text-xs text-foreground-muted">
          Une analyse approfondie prend plus de temps qu&apos;une formation
          classique : elle mène plusieurs recherches web et rédige un
          contenu plus long et plus détaillé.
        </p>
      </div>
    );
  }

  const isEmpty = topic.trim().length === 0;
  const quotaReached = remainingGenerations <= 0;

  if (!isPro) {
    return (
      <Card variant="panel" className="w-full max-w-2xl text-center">
        <p className="text-sm font-medium text-foreground">Fonctionnalité réservée au plan Pro</p>
        <p className="mt-2 text-sm text-foreground-muted">
          L&apos;analyse approfondie mène des recherches web poussées sur des cas
          réels et produit un contenu bien plus long qu&apos;une formation
          classique — elle est réservée aux abonnés Pro.
        </p>
        <Button href="/pricing" className="mt-4">
          Voir les tarifs
        </Button>
      </Card>
    );
  }

  if (quotaReached) {
    return (
      <Card variant="panel" className="w-full max-w-2xl text-center">
        <p className="text-sm font-medium text-foreground">Limite mensuelle atteinte</p>
        <p className="mt-2 text-sm text-foreground-muted">
          Tu as utilisé tes analyses approfondies pour cette période de
          facturation. Le quota se réinitialise automatiquement à ton
          prochain renouvellement.
        </p>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-2xl">
      {error && <Callout tone="error" className="mb-4">{error}</Callout>}
      <form onSubmit={handleSubmit} className="group relative rounded-[28px] p-px">
        <div
          aria-hidden
          className="absolute inset-0 rounded-[28px] bg-gradient-to-br from-accent-blue/50 via-white/10 to-accent-violet/50 opacity-60 transition-opacity duration-500 group-focus-within:opacity-100"
        />
        <div className="relative rounded-[28px] bg-background-elevated/80 p-3 sm:p-4">
          <textarea
            ref={textareaRef}
            value={topic}
            onChange={(e) => {
              setTopic(e.target.value.slice(0, MAX_LENGTH));
              resizeTextarea();
            }}
            placeholder="Sur quel sujet veux-tu une analyse approfondie ? (ex : la finance décentralisée)"
            rows={2}
            maxLength={MAX_LENGTH}
            className="max-h-60 w-full resize-none bg-transparent px-3 py-4 text-xl leading-relaxed text-foreground placeholder:text-foreground-muted/70 focus:outline-none"
          />
          <div className="flex items-center justify-between border-t border-border-subtle px-3 pt-3">
            <span className="text-xs text-foreground-muted">
              {topic.length}/{MAX_LENGTH}
            </span>
            <Button type="submit" disabled={isEmpty}>
              Lancer l&apos;analyse
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
