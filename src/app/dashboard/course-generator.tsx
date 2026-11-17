"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ChapterChat } from "@/components/chapter-chat";
import { CourseView } from "@/components/course-view";
import { GenerationProgress } from "@/components/generation-progress";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { getGenerationStatus } from "@/lib/courses/generation-status";
import { FREE_PLAN_UNLOCKED_CHAPTERS } from "@/lib/courses/plan";
import type {
  Analysis,
  DiagnosticAnswer,
  DiagnosticQuestion,
  GeneratedCourse,
  GenerationStage,
  Programme,
  VerifiedExample,
} from "@/lib/courses/schemas";

// Prompt 05.18.1 : remplace le parcours "sujet -> génération immédiate" par
// un parcours en plusieurs étapes (diagnostic adaptatif -> plan proposé,
// modifiable -> validation -> génération réelle), tout en conservant
// "configuration rapide" comme parcours alternatif STRICTEMENT inchangé
// (même appel /api/courses/generate avec seulement { topic }, qui déclenche
// côté serveur exactement le même generateCourse() qu'avant cette tâche).

type Status =
  | "idle"
  | "diagnostic"
  | "building_plan"
  | "plan_review"
  | "generating"
  | "done"
  | "error";

type PlanContext = {
  analysis: Analysis;
  verifiedExamples: VerifiedExample[];
  programme: Programme;
  estimatedMinutes: number;
};

type StreamEvent = {
  reservationId?: string;
  stage?: GenerationStage | "done" | "error";
  label?: string;
  course?: GeneratedCourse;
  courseId?: string | null;
  message?: string;
  saveWarning?: string | null;
};

const MAX_LENGTH = 500;
const MAX_ANSWER_LENGTH = 500;
const SESSION_STORAGE_KEY = "tavyra:course-generation";
// Un peu au-delà de maxDuration=540s côté serveur (route.ts) : passé ce
// délai sans confirmation, on ne prétend plus que la génération est
// "toujours en cours" — voir handleResume ci-dessous.
const MAX_PLAUSIBLE_GENERATION_MS = 600_000;
const STATUS_POLL_INTERVAL_MS = 5000;

type StoredGeneration = { reservationId: string; topic: string; startedAt: number };

function loadStoredGeneration(): StoredGeneration | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredGeneration;
    if (!parsed.reservationId || !parsed.topic || !parsed.startedAt) return null;
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

async function readNdjson(
  response: Response,
  onLine: (line: StreamEvent) => void,
): Promise<void> {
  if (!response.body) return;
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
      if (line) onLine(JSON.parse(line) as StreamEvent);
    }
  }
}

export function CourseGenerator({
  remainingGenerations,
  locked,
}: {
  remainingGenerations: number;
  locked: boolean;
}) {
  const router = useRouter();
  // Prompt 05.18.1 (reprise après rechargement) : état initial calculé à
  // partir d'une éventuelle génération déjà en cours (marqueur laissé en
  // sessionStorage avant un rechargement de page) — jamais défini via un
  // `setState` synchrone dans un effet (voir l'effet ci-dessous, qui ne
  // fait que RELIRE l'état côté serveur de façon asynchrone).
  const [topic, setTopic] = useState(() => loadStoredGeneration()?.topic ?? "");
  const [status, setStatus] = useState<Status>(() => (loadStoredGeneration() ? "generating" : "idle"));
  const [stage, setStage] = useState<GenerationStage>("analyse");
  const [course, setCourse] = useState<GeneratedCourse | null>(null);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  const [resumeNotice, setResumeNotice] = useState<string | null>(() =>
    loadStoredGeneration() ? "Vérification de l'état de ta génération en cours…" : null,
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // --- Diagnostic adaptatif ---
  const [diagnosticAnswers, setDiagnosticAnswers] = useState<DiagnosticAnswer[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<DiagnosticQuestion | null>(null);
  const [diagnosticChoice, setDiagnosticChoice] = useState<string>("");

  // --- Plan proposé, modifiable ---
  const [plan, setPlan] = useState<PlanContext | null>(null);
  const [adjustmentRequest, setAdjustmentRequest] = useState("");
  const [showAdjustmentField, setShowAdjustmentField] = useState(false);

  const reservationRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Prompt 05.18.1 (protection contre les doubles soumissions) : vérifié ET
  // positionné de façon SYNCHRONE, indépendamment du cycle de rendu React —
  // contrairement à une simple vérification de `status`, un `ref` est à
  // jour immédiatement, même si deux clics arrivent avant qu'un nouveau
  // rendu n'ait eu lieu (React peut regrouper plusieurs mises à jour d'état
  // avant de redessiner, un simple test sur `status` pourrait donc laisser
  // passer un second appel).
  const isGeneratingRef = useRef(false);

  function resizeTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  // Prompt 05.18.1 (reprise après rechargement) : au montage, si une
  // génération a été lancée avant un rechargement de page (marqueur
  // laissé en sessionStorage), on ne redémarre JAMAIS une nouvelle
  // génération ni une nouvelle réservation — on va seulement RELIRE
  // l'état réel de celle déjà en cours côté serveur.
  useEffect(() => {
    const loaded = loadStoredGeneration();
    if (!loaded) return;
    const stored = loaded;
    reservationRef.current = stored.reservationId;

    async function checkOnce() {
      const result = await getGenerationStatus(stored.reservationId, "course");

      if (result.status === "completed") {
        stopPolling();
        storeGeneration(null);
        if (result.resourceId) {
          router.push(`/dashboard/formations/${result.resourceId}`);
        } else {
          setResumeNotice(null);
          setStatus("done");
        }
        return;
      }

      if (result.status === "released" || result.status === "not_found") {
        stopPolling();
        storeGeneration(null);
        setResumeNotice(null);
        setError(
          "La génération précédente s'est arrêtée (ou a expiré) avant la fin. Réessaie.",
        );
        setStatus("error");
        return;
      }

      if (result.status === "unknown") {
        // Jamais affirmer qu'elle continue si on ne peut pas le confirmer.
        setResumeNotice(
          "Impossible de confirmer l'état de ta génération pour le moment (connexion instable). Nouvelle tentative dans quelques secondes…",
        );
        return;
      }

      // status === "pending" : réellement toujours en cours, confirmé.
      const elapsed = Date.now() - stored.startedAt;
      if (elapsed > MAX_PLAUSIBLE_GENERATION_MS) {
        // Au-delà d'une durée plausible, on ne peut plus raisonnablement
        // affirmer qu'elle est "toujours en cours" sans nouvelle preuve.
        stopPolling();
        storeGeneration(null);
        setResumeNotice(null);
        setError(
          "Nous ne parvenons plus à confirmer l'état de cette génération après un délai inhabituel. Réessaie — ton quota n'a pas été consommé si elle n'a pas abouti.",
        );
        setStatus("error");
        return;
      }
      setResumeNotice("Ta génération précédente est toujours en cours…");
    }

    checkOnce();
    pollRef.current = setInterval(checkOnce, STATUS_POLL_INTERVAL_MS);
    return () => stopPolling();
    // Volontairement une seule fois au montage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startDiagnostic() {
    const trimmed = topic.trim();
    if (!trimmed || status !== "idle") return;
    setStatus("building_plan");
    setError(null);
    try {
      const response = await fetch("/api/courses/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "question", topic: trimmed, previousAnswers: [] }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "Impossible de démarrer le diagnostic.");
      if (payload.question) {
        setCurrentQuestion(payload.question as DiagnosticQuestion);
        setDiagnosticAnswers([]);
        setDiagnosticChoice("");
        setStatus("diagnostic");
      } else {
        // Aucune question nécessaire pour ce sujet : passe directement au plan.
        await buildPlan([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setStatus("idle");
    }
  }

  async function answerDiagnosticQuestion(answerText: string) {
    if (!currentQuestion || !answerText.trim()) return;
    const nextAnswers: DiagnosticAnswer[] = [
      ...diagnosticAnswers,
      { questionId: currentQuestion.id, question: currentQuestion.question, answer: answerText.trim() },
    ];
    setDiagnosticAnswers(nextAnswers);
    setDiagnosticChoice("");
    setStatus("building_plan");
    setError(null);
    try {
      const response = await fetch("/api/courses/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "question", topic: topic.trim(), previousAnswers: nextAnswers }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "Impossible de poursuivre le diagnostic.");
      if (payload.question) {
        setCurrentQuestion(payload.question as DiagnosticQuestion);
        setStatus("diagnostic");
      } else {
        await buildPlan(nextAnswers);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setStatus("diagnostic");
    }
  }

  async function buildPlan(answers: DiagnosticAnswer[]) {
    setStatus("building_plan");
    setError(null);
    try {
      const response = await fetch("/api/courses/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "build", topic: topic.trim(), diagnosticAnswers: answers }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "Impossible de construire le plan.");
      setPlan(payload as PlanContext);
      setStatus("plan_review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setStatus("idle");
    }
  }

  async function requestAdjustment() {
    if (!plan || !adjustmentRequest.trim()) return;
    setStatus("building_plan");
    setError(null);
    try {
      const response = await fetch("/api/courses/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "adjust",
          topic: topic.trim(),
          diagnosticAnswers,
          adjustmentRequest: adjustmentRequest.trim(),
          analysis: plan.analysis,
          verifiedExamples: plan.verifiedExamples,
          programme: plan.programme,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "Impossible d'ajuster le plan.");
      setPlan(payload as PlanContext);
      setAdjustmentRequest("");
      setShowAdjustmentField(false);
      setStatus("plan_review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setStatus("plan_review");
    }
  }

  function updateModuleField(moduleIndex: number, field: "title" | "objective", value: string) {
    setPlan((prev) => {
      if (!prev) return prev;
      const modules = prev.programme.modules.map((m, i) =>
        i === moduleIndex ? { ...m, [field]: value } : m,
      );
      return { ...prev, programme: { ...prev.programme, modules } };
    });
  }

  function updateChapterField(
    moduleIndex: number,
    chapterIndex: number,
    field: "title" | "summary",
    value: string,
  ) {
    setPlan((prev) => {
      if (!prev) return prev;
      const modules = prev.programme.modules.map((m, i) => {
        if (i !== moduleIndex) return m;
        const chapters = m.chapters.map((c, j) => (j === chapterIndex ? { ...c, [field]: value } : c));
        return { ...m, chapters };
      });
      return { ...prev, programme: { ...prev.programme, modules } };
    });
  }

  async function runGeneration(body: Record<string, unknown>) {
    if (isGeneratingRef.current) return;
    isGeneratingRef.current = true;
    setStatus("generating");
    setStage("analyse");
    setError(null);
    setCourse(null);

    try {
      const response = await fetch("/api/courses/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Impossible de lancer la génération.");
      }

      await readNdjson(response, (parsed) => {
        if (parsed.reservationId) {
          // Persisté AVANT tout autre traitement : si la page est
          // rechargée à n'importe quel instant après cette ligne, elle
          // pourra toujours retrouver cette génération (voir l'effet de
          // reprise ci-dessus) — jamais de double réservation possible,
          // la quota a déjà été consommée côté serveur à cet instant.
          reservationRef.current = parsed.reservationId;
          storeGeneration({ reservationId: parsed.reservationId, topic: topic.trim(), startedAt: Date.now() });
          return;
        }
        if (parsed.stage === "error") {
          throw new Error(parsed.message ?? "La génération a échoué.");
        }
        if (parsed.stage === "done" && parsed.course) {
          storeGeneration(null);
          setCourse(parsed.course);
          setCourseId(parsed.courseId ?? null);
          setSaveWarning(parsed.saveWarning ?? null);
          setStatus("done");
          router.refresh();
          return;
        }
        if (parsed.stage) setStage(parsed.stage as GenerationStage);
      });
    } catch (err) {
      storeGeneration(null);
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setStatus("error");
    } finally {
      isGeneratingRef.current = false;
    }
  }

  // Parcours "configuration rapide" : comportement STRICTEMENT identique à
  // avant le Prompt 05.18.1 (même endpoint, même payload { topic } seul).
  async function handleQuickSubmit() {
    const trimmed = topic.trim();
    if (!trimmed || status !== "idle") return;
    await runGeneration({ topic: trimmed });
  }

  // Parcours principal (Prompt 05.18.1) : lance le diagnostic adaptatif
  // plutôt qu'une génération immédiate — c'est désormais le comportement
  // par défaut du formulaire (touche Entrée incluse).
  function handleFormSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    startDiagnostic();
  }

  async function handleValidatePlan() {
    if (!plan || status !== "plan_review") return;
    await runGeneration({
      topic: topic.trim(),
      plan: {
        analysis: plan.analysis,
        verifiedExamples: plan.verifiedExamples,
        programme: plan.programme,
      },
    });
  }

  function startOver() {
    setStatus("idle");
    setTopic("");
    setCourse(null);
    setCourseId(null);
    setError(null);
    setPlan(null);
    setDiagnosticAnswers([]);
    setCurrentQuestion(null);
    setResumeNotice(null);
  }

  if (status === "done" && course) {
    return (
      <div className="flex w-full flex-col items-center">
        {saveWarning && (
          <Callout tone="warning" className="mb-6 max-w-2xl text-center">
            Ta formation est prête mais n&apos;a pas pu être sauvegardée ({saveWarning}). Elle ne sera pas visible après avoir quitté cette page.
          </Callout>
        )}
        <CourseView course={course} courseId={courseId} locked={locked} />
        <Button type="button" variant="secondary" onClick={startOver} className="mt-8">
          Générer une autre formation
        </Button>
        <ChapterChat
          course={course}
          courseId={courseId}
          maxChapterIndex={locked ? FREE_PLAN_UNLOCKED_CHAPTERS - 1 : undefined}
        />
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
        <GenerationProgress currentStage={stage} />
      </div>
    );
  }

  const isEmpty = topic.trim().length === 0;
  const quotaReached = remainingGenerations <= 0;

  if (quotaReached) {
    return (
      <Card variant="panel" className="w-full max-w-2xl text-center">
        <p className="text-sm font-medium text-foreground">
          {locked ? "Limite du plan gratuit atteinte" : "Limite mensuelle atteinte"}
        </p>
        <p className="mt-2 text-sm text-foreground-muted">
          {locked
            ? "Le plan gratuit permet de générer une formation. Débloque la formation complète pour continuer à apprendre avec Tavyra."
            : "Tu as utilisé tes formations pour cette période de facturation. Le quota se réinitialise automatiquement à ton prochain renouvellement."}
        </p>
        {locked && (
          <Button href="/pricing" className="mt-4">
            Voir les tarifs
          </Button>
        )}
      </Card>
    );
  }

  if (status === "diagnostic" && currentQuestion) {
    return (
      <div className="w-full max-w-2xl">
        {error && <Callout tone="error" className="mb-4">{error}</Callout>}
        <Card variant="panel">
          <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
            Question {diagnosticAnswers.length + 1}
          </p>
          <h3 className="mt-2 text-lg font-semibold text-foreground">{currentQuestion.question}</h3>

          {currentQuestion.type === "single_choice" && currentQuestion.choices ? (
            <div className="mt-4 flex flex-col gap-2">
              {currentQuestion.choices.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  onClick={() => answerDiagnosticQuestion(choice)}
                  className="rounded-xl border border-border-subtle bg-white/[0.02] px-4 py-3 text-left text-sm text-foreground transition-colors hover:border-accent-violet/60 hover:bg-white/[0.05]"
                >
                  {choice}
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-4">
              <textarea
                value={diagnosticChoice}
                onChange={(e) => setDiagnosticChoice(e.target.value.slice(0, MAX_ANSWER_LENGTH))}
                maxLength={MAX_ANSWER_LENGTH}
                rows={2}
                placeholder="Ta réponse…"
                className="w-full resize-none rounded-xl border border-border-subtle bg-white/[0.03] px-4 py-3 text-sm text-foreground placeholder:text-foreground-muted/60 focus:border-accent-violet/60 focus:outline-none"
              />
              <Button
                type="button"
                className="mt-3"
                disabled={!diagnosticChoice.trim()}
                onClick={() => answerDiagnosticQuestion(diagnosticChoice)}
              >
                Répondre
              </Button>
            </div>
          )}

          <button
            type="button"
            onClick={() => runGeneration({ topic: topic.trim() })}
            className="mt-6 block text-xs text-foreground-muted underline underline-offset-2 hover:text-foreground"
          >
            Passer directement à la configuration rapide (sans diagnostic)
          </button>
        </Card>
      </div>
    );
  }

  if (status === "building_plan") {
    return (
      <div className="flex w-full flex-col items-center py-16">
        <GenerationProgress currentStage="analyse" />
        <p className="mt-4 text-sm text-foreground-muted">Préparation du plan de ta formation…</p>
      </div>
    );
  }

  if (status === "plan_review" && plan) {
    const { programme } = plan;
    return (
      <div className="w-full max-w-3xl">
        {error && <Callout tone="error" className="mb-4">{error}</Callout>}
        <Card variant="panel">
          <h2 className="text-lg font-semibold text-foreground">Plan proposé</h2>
          <p className="mt-2 text-sm text-foreground-muted">{programme.introduction}</p>
          <p className="mt-2 text-xs font-medium text-accent-violet-light">
            Durée estimée : environ {Math.round(plan.estimatedMinutes / 10) * 10} minutes
          </p>

          <ul className="mt-4 space-y-1.5 text-sm text-foreground">
            {programme.objectives.map((objective, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-accent-violet-light">✓</span>
                <span>{objective}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 space-y-6">
            {programme.modules.map((module, moduleIndex) => (
              <div key={moduleIndex} className="rounded-2xl border border-border-subtle bg-white/[0.02] p-4">
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                    Module {moduleIndex + 1} — titre
                  </span>
                  <input
                    value={module.title}
                    onChange={(e) => updateModuleField(moduleIndex, "title", e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border-subtle bg-white/[0.03] px-3 py-2 text-sm text-foreground focus:border-accent-violet/60 focus:outline-none"
                  />
                </label>
                <label className="mt-2 block">
                  <span className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                    Objectif pédagogique
                  </span>
                  <input
                    value={module.objective}
                    onChange={(e) => updateModuleField(moduleIndex, "objective", e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border-subtle bg-white/[0.03] px-3 py-2 text-sm text-foreground focus:border-accent-violet/60 focus:outline-none"
                  />
                </label>

                <ul className="mt-3 space-y-2">
                  {module.chapters.map((chapter, chapterIndex) => (
                    <li key={chapterIndex} className="rounded-lg border border-border-subtle/60 bg-white/[0.02] p-2.5">
                      <input
                        value={chapter.title}
                        onChange={(e) =>
                          updateChapterField(moduleIndex, chapterIndex, "title", e.target.value)
                        }
                        className="w-full bg-transparent text-sm font-medium text-foreground focus:outline-none"
                      />
                      <input
                        value={chapter.summary}
                        onChange={(e) =>
                          updateChapterField(moduleIndex, chapterIndex, "summary", e.target.value)
                        }
                        className="mt-1 w-full bg-transparent text-xs text-foreground-muted focus:outline-none"
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {showAdjustmentField ? (
            <div className="mt-6">
              <textarea
                value={adjustmentRequest}
                onChange={(e) => setAdjustmentRequest(e.target.value.slice(0, 500))}
                maxLength={500}
                rows={2}
                placeholder="Décris l'ajustement que tu veux (ex : plus d'exercices pratiques, un module en plus sur…)"
                className="w-full resize-none rounded-xl border border-border-subtle bg-white/[0.03] px-4 py-3 text-sm text-foreground placeholder:text-foreground-muted/60 focus:border-accent-violet/60 focus:outline-none"
              />
              <div className="mt-2 flex gap-2">
                <Button type="button" disabled={!adjustmentRequest.trim()} onClick={requestAdjustment}>
                  Envoyer l&apos;ajustement
                </Button>
                <Button type="button" variant="secondary" onClick={() => setShowAdjustmentField(false)}>
                  Annuler
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-6 flex flex-wrap gap-3">
              <Button type="button" onClick={handleValidatePlan}>
                Valider et générer la formation
              </Button>
              <Button type="button" variant="secondary" onClick={() => setShowAdjustmentField(true)}>
                Demander un ajustement
              </Button>
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl">
      {error && <Callout tone="error" className="mb-4">{error}</Callout>}
      <form onSubmit={handleFormSubmit} className="group relative rounded-[28px] p-px">
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
            placeholder="Que veux-tu apprendre ?"
            rows={2}
            maxLength={MAX_LENGTH}
            className="max-h-60 w-full resize-none bg-transparent px-3 py-4 text-xl leading-relaxed text-foreground placeholder:text-foreground-muted/70 focus:outline-none"
          />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-3 pt-3">
            <span className="text-xs text-foreground-muted">
              {topic.length}/{MAX_LENGTH}
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={isEmpty}
                onClick={handleQuickSubmit}
                className="text-xs text-foreground-muted underline underline-offset-2 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                Configuration rapide (sans diagnostic)
              </button>
              <Button type="submit" disabled={isEmpty}>
                Créer avec le diagnostic guidé
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
