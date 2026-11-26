"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
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

// Prompt 05.18.1 : diagnostic adaptatif -> plan proposé, modifiable ->
// validation -> génération. Prompt 05.20.1 (suite de l'audit 05.19/05.20,
// risque critique sur Netlify) : la génération elle-même n'est plus UNE
// requête HTTP streamée pouvant durer plusieurs minutes — c'est maintenant
// une boucle d'appels COURTS et répétés ("étape suivante"), chacun
// persistant sa progression côté Supabase avant de répondre
// (/api/courses/generate, action "start" puis "step" répétée). Consé-
// quence assumée et honnête : la génération n'avance plus tant que cet
// onglet n'envoie pas d'appel "step" — fermer l'onglet la met en pause
// SANS JAMAIS LA PERDRE (chaque étape déjà terminée reste acquise), elle
// reprend exactement où elle s'est arrêtée au retour sur cette page, au
// lieu de continuer en arrière-plan comme avant.

type Status =
  | "idle"
  | "diagnostic"
  | "building_plan"
  | "plan_review"
  | "generating"
  | "free_ready"
  | "done"
  | "error";

type PlanContext = {
  analysis: Analysis;
  verifiedExamples: VerifiedExample[];
  programme: Programme;
  estimatedMinutes: number;
};

type ServerPlan = { analysis: Analysis; verifiedExamples: VerifiedExample[]; programme: Programme };

// Repères de parcours (purement visuels) : les 4 grandes phases réelles du
// state machine ci-dessus, jamais un détail interne inventé — le
// diagnostic lui-même pose un nombre de questions variable (adaptatif),
// donc ce repère ne prétend jamais connaître à l'avance combien il en reste.
const JOURNEY_PHASES = ["Sujet", "Diagnostic", "Plan", "Génération"] as const;

function phaseIndexForStatus(status: Status): number {
  switch (status) {
    case "diagnostic":
      return 1;
    case "building_plan":
    case "plan_review":
      return 2;
    case "generating":
    case "free_ready":
      return 3;
    default:
      return 0;
  }
}

function JourneyBreadcrumb({ status }: { status: Status }) {
  const activeIndex = phaseIndexForStatus(status);
  return (
    <div className="mb-6 flex items-center justify-center gap-2" aria-hidden>
      {JOURNEY_PHASES.map((phase, i) => (
        <div key={phase} className="flex items-center gap-2">
          <span
            className={`text-xs font-medium transition-colors ${
              i === activeIndex
                ? "text-foreground"
                : i < activeIndex
                  ? "text-accent-violet-light"
                  : "text-foreground-muted/50"
            }`}
          >
            {phase}
          </span>
          {i < JOURNEY_PHASES.length - 1 && (
            <span
              className={`h-px w-6 ${i < activeIndex ? "bg-accent-violet/50" : "bg-border-subtle"}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

const MAX_LENGTH = 500;
const MAX_ANSWER_LENGTH = 500;
const SESSION_STORAGE_KEY = "tavyra:course-generation";

// Prompt 06.9 : simples suggestions pour aider à démarrer — jamais
// soumises automatiquement (l'utilisateur garde la main et peut modifier
// le texte avant de valider), aucune n'est spécifique à un domaine plus
// qu'un autre.
const EXAMPLE_TOPICS = [
  "Les bases de la bourse pour débutant",
  "Le SEO pour un petit site",
  "Négocier son salaire",
  "La gestion de projet Agile",
];
// Après ce nombre d'échecs consécutifs d'un appel "étape suivante"
// (panne réseau, erreur transitoire côté serveur), on arrête de
// réessayer automatiquement plutôt que de le faire indéfiniment sans que
// l'utilisateur en soit informé — la génération reste reprenable (rien
// n'est perdu, aucune étape déjà validée n'est refaite).
const MAX_TRANSIENT_RETRIES = 6;
const BUSY_RETRY_DELAY_MS = 1500;

type StoredGeneration = {
  idempotencyKey: string;
  // `null` tant que la réponse de "start" n'a pas encore été reçue —
  // voir l'effet de reprise ci-dessous : dans ce cas, "start" est rejoué
  // avec la MÊME clé d'idempotence au lieu d'être perdu.
  reservationId: string | null;
  topic: string;
  plan?: ServerPlan;
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

// Prompt 06.39 (demande explicite : "assure-toi que quand il a l'abonnement
// il a accès à sa formation") : le sujet tapé avant la fausse génération du
// plan gratuit est conservé ici, pour qu'un utilisateur qui s'abonne juste
// après (voir le bouton de l'écran "free_ready" ci-dessous) retrouve ce même
// sujet pré-rempli à son retour sur cette page, au lieu de devoir tout
// retaper. `sessionStorage` (pas `localStorage`) : jamais conservé plus
// longtemps qu'un onglet, jamais question de données sensibles persistées.
const FREE_DRAFT_TOPIC_KEY = "tavyra:free-draft-topic";

function loadFreeDraftTopic(): string | null {
  try {
    return sessionStorage.getItem(FREE_DRAFT_TOPIC_KEY);
  } catch {
    return null;
  }
}

function storeFreeDraftTopic(value: string | null) {
  try {
    if (value) sessionStorage.setItem(FREE_DRAFT_TOPIC_KEY, value);
    else sessionStorage.removeItem(FREE_DRAFT_TOPIC_KEY);
  } catch {
    // Stockage indisponible : le sujet ne sera pas pré-rempli après
    // l'abonnement, mais ça n'empêche jamais de créer sa formation.
  }
}

type StartResponse = { reservationId?: string; error?: string };
type StepResponse = {
  done?: boolean;
  busy?: boolean;
  transientError?: boolean;
  alreadyResolved?: boolean;
  fatalError?: string;
  stage?: GenerationStage;
  label?: string;
  courseId?: string | null;
  course?: GeneratedCourse;
  saveWarning?: string | null;
  error?: string;
};

export function CourseGenerator({
  remainingGenerations,
  locked,
  initialTopic = "",
}: {
  remainingGenerations: number;
  locked: boolean;
  /** Sujet pré-rempli depuis une suggestion (`/dashboard/creer?sujet=…`). */
  initialTopic?: string;
}) {
  const router = useRouter();
  // Prompt 06.39 (demande explicite : "assure-toi que quand il a
  // l'abonnement il a accès à sa formation") : si ce compte est désormais
  // Pro et qu'aucune vraie génération n'est en cours de reprise, on
  // retrouve ici le sujet laissé en attente par l'écran "free_ready"
  // (abonnement souscrit juste après, voir storeFreeDraftTopic ci-dessus) —
  // jamais pour un compte resté gratuit. Calculé UNE SEULE FOIS, dans les
  // initialiseurs paresseux de useState ci-dessous (jamais dans un effet,
  // qui ne doit pas appeler setState de façon synchrone) — exactement
  // comme `loadStoredGeneration()` ci-dessous, déjà lu de la même façon.
  const [topic, setTopic] = useState(() => {
    const stored = loadStoredGeneration();
    if (stored) return stored.topic;
    if (!locked) {
      const draft = loadFreeDraftTopic();
      if (draft) return draft;
    }
    return initialTopic;
  });
  const [status, setStatus] = useState<Status>(() => (loadStoredGeneration() ? "generating" : "idle"));
  const [stage, setStage] = useState<GenerationStage>("chapitres");
  const [course, setCourse] = useState<GeneratedCourse | null>(null);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  const [resumeNotice, setResumeNotice] = useState<string | null>(() =>
    loadStoredGeneration() ? "Reprise de ta génération en cours…" : null,
  );
  // Prompt 06.40 (demande explicite : "si tu comprends pas le sujet met un
  // message en disant que tu ne comprends pas le sujet") : distinct de
  // `error` (réservé aux vraies pannes) — un sujet pas compris n'est pas
  // une erreur technique, juste une invitation à préciser.
  const [unclearTopicNotice, setUnclearTopicNotice] = useState<string | null>(null);
  const [restoredDraftNotice, setRestoredDraftNotice] = useState<string | null>(() => {
    if (loadStoredGeneration() || locked) return null;
    const draft = loadFreeDraftTopic();
    if (!draft) return null;
    // Consommé une seule fois ici (dernier des deux initialiseurs à lire
    // cette entrée) : jamais réutilisé à un prochain montage.
    storeFreeDraftTopic(null);
    return `On a retrouvé le sujet de ta formation : « ${draft} ». Tu peux la créer dès maintenant.`;
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // --- Diagnostic adaptatif ---
  const [diagnosticAnswers, setDiagnosticAnswers] = useState<DiagnosticAnswer[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<DiagnosticQuestion | null>(null);
  const [diagnosticChoice, setDiagnosticChoice] = useState<string>("");

  // --- Plan proposé, modifiable ---
  const [plan, setPlan] = useState<PlanContext | null>(null);
  const [adjustmentRequest, setAdjustmentRequest] = useState("");
  const [showAdjustmentField, setShowAdjustmentField] = useState(false);

  // Protection contre les doubles soumissions (Prompt 05.18.1) : vérifié ET
  // positionné de façon SYNCHRONE, indépendamment du cycle de rendu React.
  const isGeneratingRef = useRef(false);

  function resizeTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }

  // Reprise après rechargement (Prompt 05.20.1) : si une génération a été
  // lancée avant un rechargement de page, on ne redémarre JAMAIS une
  // nouvelle génération ni une nouvelle réservation — on reprend
  // directement la boucle d'étapes courtes à l'endroit exact où elle
  // s'est arrêtée (la progression déjà validée est persistée côté
  // Supabase, jamais perdue). Si "start" n'avait pas encore reçu de
  // réponse au moment du rechargement, il est rejoué avec la MÊME clé
  // d'idempotence — jamais une seconde réservation pour la même intention.
  useEffect(() => {
    const loaded = loadStoredGeneration();
    if (!loaded) return;

    (async () => {
      let reservationId = loaded.reservationId;
      if (!reservationId) {
        try {
          const response = await fetch("/api/courses/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "start",
              idempotencyKey: loaded.idempotencyKey,
              topic: loaded.topic,
              ...(loaded.plan ? { plan: loaded.plan } : {}),
            }),
          });
          const payload = (await response.json().catch(() => null)) as StartResponse | null;
          if (!response.ok || !payload?.reservationId) {
            storeGeneration(null);
            setResumeNotice(null);
            setError(payload?.error ?? "La génération précédente n'a pas pu être reprise. Réessaie.");
            setStatus("error");
            return;
          }
          reservationId = payload.reservationId;
          storeGeneration({ ...loaded, reservationId });
        } catch {
          // Réseau indisponible maintenant : jamais affirmer que la
          // génération a échoué — elle reste peut-être bel et bien en
          // cours côté serveur si "start" avait en réalité réussi.
          setResumeNotice(
            "Impossible de confirmer l'état de ta génération pour le moment (connexion instable). Recharge la page pour réessayer.",
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

  async function startDiagnostic() {
    const trimmed = topic.trim();
    if (!trimmed || status !== "idle") return;
    setStatus("building_plan");
    setError(null);
    setUnclearTopicNotice(null);
    try {
      const response = await fetch("/api/courses/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "question", topic: trimmed, previousAnswers: [] }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "Impossible de démarrer le diagnostic.");
      if (payload.unclear) {
        setUnclearTopicNotice(
          `Je ne suis pas sûre de comprendre ce que tu veux apprendre avec « ${trimmed} ». Peux-tu préciser ou reformuler ton sujet ?`,
        );
        setStatus("idle");
        return;
      }
      if (payload.question) {
        setCurrentQuestion(payload.question as DiagnosticQuestion);
        setDiagnosticAnswers([]);
        setDiagnosticChoice("");
        setStatus("diagnostic");
      } else {
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
      if (payload.unclear) {
        // Prompt 06.40 : ne peut arriver qu'au fil du diagnostic adaptatif
        // (plan Pro) — ramène à l'écran de départ pour reformuler le sujet
        // plutôt que de continuer un diagnostic sur un sujet mal compris.
        setUnclearTopicNotice(
          `Je ne suis pas sûre de comprendre ce que tu veux apprendre avec « ${topic.trim()} ». Peux-tu préciser ou reformuler ton sujet ?`,
        );
        setStatus("idle");
        return;
      }
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

  // Prompt 06.37 (demande explicite de l'utilisateur, suite à un risque de
  // viralité réel : "si je fais 1M de vues et que 10% testent en gratuit,
  // ça tuera mon crédit") : le plan gratuit ne déclenche plus JAMAIS la
  // vraie construction du plan ni la vraie génération (buildCoursePlan,
  // generateCourse — les étapes réellement coûteuses en appels Claude).
  // Une fois le diagnostic terminé (lui-même désormais gratuit, voir
  // generate.ts), on affiche quelques secondes le même indicateur de
  // progression que pour une vraie génération, puis — Prompt 06.39, demande
  // explicite : "précise-lui que la formation est prête mais faut passer
  // sur un plan" — on affiche l'écran "free_ready" ci-dessous au lieu de
  // rediriger silencieusement : jamais de formation réelle produite pour ce
  // plan, mais JAMAIS non plus un utilisateur qui se retrouve sur /pricing
  // sans comprendre pourquoi. Les comptes Pro (`!locked`) suivent le
  // parcours réel inchangé ci-dessous.
  const FREE_TEASER_STAGES: GenerationStage[] = ["analyse", "recherche", "programme", "chapitres"];
  const FREE_TEASER_STEP_MS = 700;

  function triggerFreeUpsell() {
    setStatus("generating");
    setStage(FREE_TEASER_STAGES[0]);
    let index = 0;
    const interval = setInterval(() => {
      index += 1;
      if (index >= FREE_TEASER_STAGES.length) {
        clearInterval(interval);
        // Prompt 06.39 : sujet conservé pour être retrouvé automatiquement
        // si l'utilisateur s'abonne dans la foulée (voir l'effet de
        // restauration plus haut) — jamais perdu entre cet écran et /pricing.
        storeFreeDraftTopic(topic.trim());
        setStatus("free_ready");
        return;
      }
      setStage(FREE_TEASER_STAGES[index]);
    }, FREE_TEASER_STEP_MS);
  }

  async function buildPlan(answers: DiagnosticAnswer[]) {
    if (locked) {
      triggerFreeUpsell();
      return;
    }
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

  /**
   * Boucle d'étapes courtes (Prompt 05.20.1) : appelle "step" répétitivement
   * jusqu'à ce que le serveur indique que la génération est terminée
   * (succès ou échec définitif). Chaque étape persiste son résultat avant
   * de répondre — jamais de double exécution d'une même étape, même si
   * cette boucle est interrompue et reprise plus tard (voir l'effet de
   * reprise ci-dessus).
   */
  async function runStepLoop(reservationId: string) {
    let consecutiveFailures = 0;

    while (true) {
      let response: Response;
      try {
        response = await fetch("/api/courses/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "step", reservationId }),
        });
      } catch {
        consecutiveFailures += 1;
        if (consecutiveFailures > MAX_TRANSIENT_RETRIES) {
          setError(
            "Impossible de contacter le serveur pour continuer la génération. Ta génération reste en cours et n'a rien perdu : recharge la page pour réessayer.",
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
          setError("Une erreur est survenue. Ta génération reste reprenable : recharge la page pour réessayer.");
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
            "La génération rencontre des difficultés techniques persistantes. Ton quota n'a pas été consommé davantage et rien n'est perdu : recharge la page pour réessayer.",
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
          const result = await getGenerationStatus(reservationId, "course");
          if (result.status === "completed" && result.resourceId) {
            router.push(`/dashboard/formations/${result.resourceId}`);
          } else if (result.status === "completed") {
            setStatus("done");
          } else {
            setError("Cette génération s'est arrêtée (ou a expiré) avant la fin. Réessaie.");
            setStatus("error");
          }
          return;
        }

        if (payload.fatalError) {
          setError(payload.fatalError);
          setStatus("error");
          return;
        }

        setCourse(payload.course ?? null);
        setCourseId(payload.courseId ?? null);
        setSaveWarning(payload.saveWarning ?? null);
        setStatus("done");
        router.refresh();
        return;
      }

      if (payload.stage) setStage(payload.stage);
    }
  }

  async function startGeneration(body: { topic: string; plan?: ServerPlan }) {
    if (isGeneratingRef.current) return;
    isGeneratingRef.current = true;
    setError(null);
    setCourse(null);
    setStatus(body.plan ? "generating" : "building_plan");
    setStage("chapitres");

    const idempotencyKey = crypto.randomUUID();
    // Persisté AVANT le premier appel réseau : si la page est rechargée à
    // n'importe quel instant après cette ligne — y compris pendant que la
    // requête "start" est encore en vol — l'effet de reprise ci-dessus
    // pourra toujours la rejouer avec la MÊME clé, jamais une seconde fois.
    storeGeneration({
      idempotencyKey,
      reservationId: null,
      topic: body.topic,
      plan: body.plan,
      startedAt: Date.now(),
    });

    try {
      const response = await fetch("/api/courses/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", idempotencyKey, topic: body.topic, plan: body.plan }),
      });
      const payload = (await response.json().catch(() => null)) as StartResponse | null;
      if (!response.ok || !payload?.reservationId) {
        throw new Error(payload?.error ?? "Impossible de lancer la génération.");
      }

      storeGeneration({
        idempotencyKey,
        reservationId: payload.reservationId,
        topic: body.topic,
        plan: body.plan,
        startedAt: Date.now(),
      });
      setStatus("generating");
      await runStepLoop(payload.reservationId);
    } catch (err) {
      storeGeneration(null);
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setStatus("error");
      isGeneratingRef.current = false;
    }
  }

  function handleFormSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    startDiagnostic();
  }

  async function handleValidatePlan() {
    if (!plan || status !== "plan_review") return;
    await startGeneration({
      topic: topic.trim(),
      plan: { analysis: plan.analysis, verifiedExamples: plan.verifiedExamples, programme: plan.programme },
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
    setRestoredDraftNotice(null);
    setUnclearTopicNotice(null);
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
        <JourneyBreadcrumb status={status} />
        {resumeNotice && (
          <Callout tone="info" role="status" className="mb-6 max-w-md text-center">
            {resumeNotice}
          </Callout>
        )}
        <GenerationProgress currentStage={stage} />
      </div>
    );
  }

  // Prompt 06.39 : jamais un silence suivi d'une redirection surprise vers
  // /pricing — l'utilisateur sait explicitement pourquoi il atterrit là.
  if (status === "free_ready") {
    return (
      <Card variant="panel" className="w-full max-w-2xl text-center">
        <span
          aria-hidden
          className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-accent-blue/15 to-accent-violet/15 text-accent-violet-light"
        >
          ✦
        </span>
        <p className="mt-4 text-sm font-medium text-foreground">Ta formation est prête</p>
        <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
          Passe au plan Pro pour y accéder dès maintenant — ton sujet reste prêt, tu n&apos;as rien à retaper.
        </p>
        <Button href="/pricing" className="mt-4">
          Voir les tarifs
        </Button>
      </Card>
    );
  }

  const isEmpty = topic.trim().length === 0;
  const quotaReached = remainingGenerations <= 0;

  if (quotaReached) {
    return (
      <Card variant="panel" className="w-full max-w-2xl text-center">
        <span
          aria-hidden
          className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-accent-blue/15 to-accent-violet/15 text-accent-violet-light"
        >
          ✦
        </span>
        <p className="mt-4 text-sm font-medium text-foreground">
          {locked ? "Limite du plan gratuit atteinte" : "Limite mensuelle atteinte"}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
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
    const isChoice = currentQuestion.type === "single_choice" && !!currentQuestion.choices;
    const canAdvance = diagnosticChoice.trim().length > 0;

    return (
      <div className="w-full max-w-2xl">
        <JourneyBreadcrumb status={status} />
        {error && <Callout tone="error" className="mb-4">{error}</Callout>}

        {/* Fil des réponses déjà données : un vrai suivi visible, jamais un
            total fixe annoncé à l'avance (le diagnostic est adaptatif — voir
            MIN/MAX_DIAGNOSTIC_QUESTIONS dans generate.ts) — seulement ce qui
            a réellement été répondu jusqu'ici. */}
        {diagnosticAnswers.length > 0 && (
          <ol className="mb-4 space-y-1.5">
            {diagnosticAnswers.map((a) => (
              <li
                key={a.questionId}
                className="flex items-start gap-2.5 rounded-xl border border-border-subtle bg-overlay/[0.02] px-3.5 py-2.5"
              >
                <span
                  aria-hidden
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-from via-brand-via to-brand-to text-white"
                >
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path
                      d="M2 5.5l2.3 2.3L9 3"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs text-foreground-muted">{a.question}</span>
                  <span className="block truncate text-sm font-medium text-foreground">{a.answer}</span>
                </span>
              </li>
            ))}
          </ol>
        )}

        <Card variant="elevated">
          <div className="flex items-center gap-3">
            <BrandMark size={30} />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent-violet-light">
                Diagnostic Tavyra
              </p>
              <p className="text-xs text-foreground-muted">
                Question {diagnosticAnswers.length + 1} — pour caler cette formation sur ton niveau réel
              </p>
            </div>
          </div>

          <h3 className="mt-4 text-xl font-semibold leading-snug text-foreground">
            {currentQuestion.question}
          </h3>

          {isChoice ? (
            <div className="mt-5 flex flex-col gap-2">
              {currentQuestion.choices!.map((choice) => {
                const active = diagnosticChoice === choice;
                return (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => setDiagnosticChoice(choice)}
                    aria-pressed={active}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-sm transition-all active:scale-[0.99] ${
                      active
                        ? "border-accent-violet/60 bg-accent-violet/10 text-foreground"
                        : "border-border-subtle bg-overlay/[0.02] text-foreground hover:bg-overlay/[0.05]"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                        active ? "border-accent-violet bg-accent-violet" : "border-border-subtle"
                      }`}
                    >
                      {active && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path
                            d="M1.5 5l2.5 2.5 4.5-5"
                            stroke="white"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </span>
                    {choice}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-5">
              <textarea
                value={diagnosticChoice}
                onChange={(e) => setDiagnosticChoice(e.target.value.slice(0, MAX_ANSWER_LENGTH))}
                maxLength={MAX_ANSWER_LENGTH}
                rows={2}
                placeholder="Ta réponse…"
                className="w-full resize-none rounded-xl border border-border-subtle bg-overlay/[0.03] px-4 py-3 text-sm text-foreground placeholder:text-foreground-muted/60 focus:border-accent-violet/60 focus:outline-none"
              />
            </div>
          )}

          <div className="mt-6 flex justify-end border-t border-border-subtle pt-4">
            <Button
              type="button"
              disabled={!canAdvance}
              onClick={() => answerDiagnosticQuestion(diagnosticChoice)}
            >
              Question suivante →
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (status === "building_plan") {
    return (
      <div className="flex w-full flex-col items-center py-16">
        <JourneyBreadcrumb status={status} />
        <GenerationProgress currentStage="analyse" />
        <p className="mt-4 text-sm text-foreground-muted">Préparation du plan de ta formation…</p>
      </div>
    );
  }

  if (status === "plan_review" && plan) {
    const { programme } = plan;
    return (
      <div className="w-full max-w-3xl">
        <JourneyBreadcrumb status={status} />
        {error && <Callout tone="error" className="mb-4">{error}</Callout>}
        <Card variant="panel">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Plan proposé</h2>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-accent-violet/25 bg-accent-violet/[0.08] px-3 py-1 text-xs font-medium text-accent-violet-light">
              ~{Math.round(plan.estimatedMinutes / 10) * 10} min
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-foreground-muted">{programme.introduction}</p>

          <ul className="mt-5 space-y-2 text-sm text-foreground">
            {programme.objectives.map((objective, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-0.5 shrink-0 text-accent-violet-light">✓</span>
                <span>{objective}</span>
              </li>
            ))}
          </ul>

          <p className="mt-8 text-xs font-medium uppercase tracking-wide text-foreground-muted">
            Modifie librement chaque module avant de lancer la génération
          </p>
          <div className="mt-3 space-y-5">
            {programme.modules.map((module, moduleIndex) => (
              <div
                key={moduleIndex}
                className="overflow-hidden rounded-2xl border border-border-subtle bg-overlay/[0.02]"
              >
                <div className="flex items-center gap-3 border-b border-border-subtle bg-overlay/[0.02] px-4 py-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-from via-brand-via to-brand-to text-[11px] font-semibold text-white">
                    {moduleIndex + 1}
                  </span>
                  <span className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                    Module {moduleIndex + 1}
                  </span>
                </div>
                <div className="p-4">
                  <label className="block">
                    <span className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                      Titre
                    </span>
                    <input
                      value={module.title}
                      onChange={(e) => updateModuleField(moduleIndex, "title", e.target.value)}
                      className="mt-1 w-full rounded-lg border border-border-subtle bg-overlay/[0.03] px-3 py-2 text-sm font-medium text-foreground transition-colors focus:border-accent-violet/60 focus:bg-overlay/[0.05] focus:outline-none"
                    />
                  </label>
                  <label className="mt-3 block">
                    <span className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                      Objectif pédagogique
                    </span>
                    <input
                      value={module.objective}
                      onChange={(e) => updateModuleField(moduleIndex, "objective", e.target.value)}
                      className="mt-1 w-full rounded-lg border border-border-subtle bg-overlay/[0.03] px-3 py-2 text-sm text-foreground transition-colors focus:border-accent-violet/60 focus:bg-overlay/[0.05] focus:outline-none"
                    />
                  </label>

                  <ul className="mt-3 space-y-2">
                    {module.chapters.map((chapter, chapterIndex) => (
                      <li
                        key={chapterIndex}
                        className="rounded-lg border border-border-subtle/60 bg-overlay/[0.02] p-2.5 transition-colors focus-within:border-accent-violet/40"
                      >
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
                className="w-full resize-none rounded-xl border border-border-subtle bg-overlay/[0.03] px-4 py-3 text-sm text-foreground placeholder:text-foreground-muted/60 focus:border-accent-violet/60 focus:outline-none"
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

  function applyExampleTopic(example: string) {
    setTopic(example);
    resizeTextarea();
    textareaRef.current?.focus();
  }

  return (
    <div className="w-full max-w-2xl">
      {restoredDraftNotice && (
        <Callout tone="info" role="status" className="mb-4">
          {restoredDraftNotice}
        </Callout>
      )}
      {unclearTopicNotice && (
        <Callout tone="warning" role="status" className="mb-4">
          {unclearTopicNotice}
        </Callout>
      )}
      {error && <Callout tone="error" className="mb-4">{error}</Callout>}
      <form onSubmit={handleFormSubmit} className="group relative rounded-[28px] p-px">
        <div
          aria-hidden
          className="absolute inset-0 rounded-[28px] bg-gradient-to-br from-accent-blue/50 via-overlay/10 to-accent-violet/50 opacity-60 transition-opacity duration-500 group-focus-within:opacity-100"
        />
        <div className="relative rounded-[28px] bg-background-elevated/80 p-3 sm:p-4">
          <textarea
            ref={textareaRef}
            value={topic}
            onChange={(e) => {
              setTopic(e.target.value.slice(0, MAX_LENGTH));
              setUnclearTopicNotice(null);
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
              <Button type="submit" disabled={isEmpty}>
                Créer ma formation
              </Button>
            </div>
          </div>
        </div>
      </form>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="text-xs text-foreground-muted">Exemples :</span>
        {EXAMPLE_TOPICS.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => applyExampleTopic(example)}
            className="rounded-full border border-border-subtle bg-overlay/[0.02] px-3 py-1.5 text-xs text-foreground-muted transition-colors hover:border-accent-violet/40 hover:text-foreground"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}
