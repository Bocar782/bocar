"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { DeepAnalysisView } from "@/components/deep-analysis-view";
import { GenerationProgress } from "@/components/generation-progress";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { getGenerationStatus } from "@/lib/courses/generation-status";
import { DEEP_STAGE_LABELS, type DeepAnalysisStage, type GeneratedDeepAnalysis } from "@/lib/analysis/schemas";

const STAGE_ORDER: DeepAnalysisStage[] = [
  "cadrage",
  "recherche",
  "redaction",
  "synthese",
  "assemblage",
  "pret",
];

// Prompt 05.20.1 (suite de l'audit 05.19/05.20, risque critique sur
// Netlify) : même architecture à étapes courtes que CourseGenerator — voir
// ce fichier pour le détail des commentaires. L'analyse approfondie
// bénéficie exactement du même mécanisme, jamais d'un niveau de fiabilité
// différent.
type Status = "idle" | "generating" | "done" | "error";

const MAX_LENGTH = 500;
const SESSION_STORAGE_KEY = "tavyra:analysis-generation";
const MAX_TRANSIENT_RETRIES = 6;
const BUSY_RETRY_DELAY_MS = 1500;

type StoredGeneration = {
  idempotencyKey: string;
  reservationId: string | null;
  topic: string;
  startedAt: number;
};

function loadStoredGeneration(): StoredGeneration | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredGeneration;
    if (!parsed.idempotencyKey || !parsed.topic || !parsed.startedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

function storeGeneration(value: StoredGeneration | null) {
  try {
    if (value) sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Stockage indisponible (navigation privée, etc.) : la reprise après
    // rechargement ne fonctionnera pas, mais la génération en cours n'est
    // jamais affectée — ignoré volontairement.
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type StartResponse = { reservationId?: string; error?: string };
type StepResponse = {
  done?: boolean;
  busy?: boolean;
  transientError?: boolean;
  alreadyResolved?: boolean;
  fatalError?: string;
  stage?: DeepAnalysisStage;
  label?: string;
  analysisId?: string | null;
  analysis?: GeneratedDeepAnalysis;
  saveWarning?: string | null;
  error?: string;
};

export function AnalysisGenerator({
  remainingGenerations,
  isPro,
}: {
  remainingGenerations: number;
  isPro: boolean;
}) {
  const router = useRouter();
  const [topic, setTopic] = useState(() => loadStoredGeneration()?.topic ?? "");
  const [status, setStatus] = useState<Status>(() => (loadStoredGeneration() ? "generating" : "idle"));
  const [stage, setStage] = useState<DeepAnalysisStage>("cadrage");
  const [analysis, setAnalysis] = useState<GeneratedDeepAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  const [resumeNotice, setResumeNotice] = useState<string | null>(() =>
    loadStoredGeneration() ? "Reprise de ton analyse en cours…" : null,
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isGeneratingRef = useRef(false);

  function resizeTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }

  // Reprise après rechargement (Prompt 05.20.1) : reprend directement la
  // boucle d'étapes courtes là où elle s'est arrêtée (progression déjà
  // persistée côté Supabase, jamais perdue), au lieu de simplement
  // surveiller un travail qui continuerait en arrière-plan — il n'y en a
  // plus. Si "start" n'avait pas encore reçu de réponse au moment du
  // rechargement, il est rejoué avec la MÊME clé d'idempotence.
  useEffect(() => {
    const loaded = loadStoredGeneration();
    if (!loaded) return;

    (async () => {
      let reservationId = loaded.reservationId;
      if (!reservationId) {
        try {
          const response = await fetch("/api/analysis/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "start", idempotencyKey: loaded.idempotencyKey, topic: loaded.topic }),
          });
          const payload = (await response.json().catch(() => null)) as StartResponse | null;
          if (!response.ok || !payload?.reservationId) {
            storeGeneration(null);
            setResumeNotice(null);
            setError(payload?.error ?? "L'analyse précédente n'a pas pu être reprise. Réessaie.");
            setStatus("error");
            return;
          }
          reservationId = payload.reservationId;
          storeGeneration({ ...loaded, reservationId });
        } catch {
          setResumeNotice(
            "Impossible de confirmer l'état de ton analyse pour le moment (connexion instable). Recharge la page pour réessayer.",
          );
          return;
        }
      }
      setTopic(loaded.topic);
      setResumeNotice(null);
      await runStepLoop(reservationId);
    })();
    // Volontairement une seule fois au montage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runStepLoop(reservationId: string) {
    let consecutiveFailures = 0;

    while (true) {
      let response: Response;
      try {
        response = await fetch("/api/analysis/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "step", reservationId }),
        });
      } catch {
        consecutiveFailures += 1;
        if (consecutiveFailures > MAX_TRANSIENT_RETRIES) {
          setError(
            "Impossible de contacter le serveur pour continuer l'analyse. Elle reste en cours et n'a rien perdu : recharge la page pour réessayer.",
          );
          setStatus("error");
          isGeneratingRef.current = false;
          return;
        }
        await sleep(Math.min(1000 * consecutiveFailures, 5000));
        continue;
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as StepResponse | null;
        storeGeneration(null);
        setError(payload?.error ?? "Une erreur est survenue.");
        setStatus("error");
        isGeneratingRef.current = false;
        return;
      }

      const payload = (await response.json().catch(() => null)) as StepResponse | null;
      if (!payload) {
        consecutiveFailures += 1;
        if (consecutiveFailures > MAX_TRANSIENT_RETRIES) {
          setError("Une erreur est survenue. L'analyse reste reprenable : recharge la page pour réessayer.");
          setStatus("error");
          isGeneratingRef.current = false;
          return;
        }
        await sleep(Math.min(1000 * consecutiveFailures, 5000));
        continue;
      }

      if (payload.busy) {
        await sleep(BUSY_RETRY_DELAY_MS);
        continue;
      }

      if (payload.transientError) {
        consecutiveFailures += 1;
        if (consecutiveFailures > MAX_TRANSIENT_RETRIES) {
          setError(
            "L'analyse rencontre des difficultés techniques persistantes. Ton quota n'a pas été consommé davantage et rien n'est perdu : recharge la page pour réessayer.",
          );
          setStatus("error");
          isGeneratingRef.current = false;
          return;
        }
        await sleep(Math.min(1000 * consecutiveFailures, 5000));
        continue;
      }

      consecutiveFailures = 0;

      if (payload.done) {
        storeGeneration(null);
        isGeneratingRef.current = false;

        if (payload.alreadyResolved) {
          const result = await getGenerationStatus(reservationId, "analysis");
          if (result.status === "completed" && result.resourceId) {
            router.push(`/dashboard/analyses/${result.resourceId}`);
          } else if (result.status === "completed") {
            setStatus("done");
          } else {
            setError("Cette analyse s'est arrêtée (ou a expiré) avant la fin. Réessaie.");
            setStatus("error");
          }
          return;
        }

        if (payload.fatalError) {
          setError(payload.fatalError);
          setStatus("error");
          return;
        }

        setAnalysis(payload.analysis ?? null);
        setSaveWarning(payload.saveWarning ?? null);
        setStatus("done");
        router.refresh();
        return;
      }

      if (payload.stage) setStage(payload.stage);
    }
  }

  async function handleSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (isGeneratingRef.current) return;
    const trimmed = topic.trim();
    if (!trimmed || status !== "idle") return;
    isGeneratingRef.current = true;

    setStatus("generating");
    setStage("cadrage");
    setError(null);
    setAnalysis(null);

    const idempotencyKey = crypto.randomUUID();
    storeGeneration({ idempotencyKey, reservationId: null, topic: trimmed, startedAt: Date.now() });

    try {
      const response = await fetch("/api/analysis/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", idempotencyKey, topic: trimmed }),
      });
      const payload = (await response.json().catch(() => null)) as StartResponse | null;
      if (!response.ok || !payload?.reservationId) {
        throw new Error(payload?.error ?? "Impossible de lancer l'analyse.");
      }

      storeGeneration({ idempotencyKey, reservationId: payload.reservationId, topic: trimmed, startedAt: Date.now() });
      await runStepLoop(payload.reservationId);
    } catch (err) {
      storeGeneration(null);
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setStatus("error");
      isGeneratingRef.current = false;
    }
  }

  function startOver() {
    setStatus("idle");
    setTopic("");
    setAnalysis(null);
    setError(null);
    setResumeNotice(null);
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
        {resumeNotice && (
          <Callout tone="info" role="status" className="mb-6 max-w-md text-center">
            {resumeNotice}
          </Callout>
        )}
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
