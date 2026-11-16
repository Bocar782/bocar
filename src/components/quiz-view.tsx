"use client";

import { useState } from "react";
import type { QuizQuestion } from "@/lib/courses/schemas";
import {
  startQuizAttempt,
  submitQuizAttempt,
  type SubmittedQuizAnswer,
} from "@/lib/courses/progress-actions";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { QuizHistory } from "./quiz-history";

type Phase = "intro" | "active" | "results";
type ReviewFilter = "all" | "mistakes";

function isMultipleChoice(question: QuizQuestion): boolean {
  return question.questionType === "multiple_choice";
}

function sortedUnique(values: number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

function sameChoiceSet(a: number[], b: number[]): boolean {
  const sortedA = sortedUnique(a);
  const sortedB = sortedUnique(b);
  return sortedA.length === sortedB.length && sortedA.every((v, i) => v === sortedB[i]);
}

/**
 * Même logique de correction que `submit_quiz_attempt` côté base de
 * données (0011_quiz_attempts.sql) : pour `multiple_choice`, égalité
 * stricte de l'ensemble des réponses sélectionnées avec l'ensemble des
 * bonnes réponses — une réponse partiellement correcte ou avec une
 * réponse supplémentaire ne compte pas comme correcte. Pour les deux
 * autres types, une seule réponse sélectionnée doit correspondre à
 * `correctChoiceIndex`. Exportée pour être testable isolément ; ce calcul
 * local ne sert qu'à l'affichage immédiat, jamais à ce qui est persisté
 * (toujours recalculé côté serveur).
 */
export function isAnswerCorrect(question: QuizQuestion, selected: number[]): boolean {
  if (isMultipleChoice(question)) {
    return sameChoiceSet(selected, question.correctChoiceIndexes ?? []);
  }
  return selected.length === 1 && selected[0] === question.correctChoiceIndex;
}

export function QuizView({
  quiz,
  quizId = null,
  title = "Quiz final",
  description = "pour vérifier ce que tu as retenu de cette formation.",
}: {
  quiz: QuizQuestion[];
  /**
   * Identifiant du quiz (table `quizzes`) à fournir aux RPC
   * start_quiz_attempt/submit_quiz_attempt (voir 0011_quiz_attempts.sql).
   * `null` si la formation n'a pas encore été sauvegardée/relue depuis la
   * base (génération fraîche) : dans ce cas, le quiz reste jouable mais
   * aucune tentative n'est enregistrée.
   */
  quizId?: string | null;
  /**
   * Titre affiché en écran d'accueil du quiz. Par défaut "Quiz final"
   * (comportement inchangé pour le quiz final de la formation, voir
   * course-view.tsx) ; un quiz de module (Prompt 05.7) passe un titre
   * propre au module concerné.
   */
  title?: string;
  /** Complète "{N} questions ..." en écran d'accueil. */
  description?: string;
}) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [currentIndex, setCurrentIndex] = useState(0);
  // Un tableau de choix sélectionnés par question (vide = rien sélectionné
  // encore). Pour les types à réponse unique (single_choice, true_false),
  // ce tableau ne contient jamais plus d'un élément.
  const [answers, setAnswers] = useState<number[][]>(
    Array.from({ length: quiz.length }, () => []),
  );
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  // Identifiant de la tentative en cours (créée côté serveur au moment où
  // l'utilisateur clique sur "Commencer le quiz"). `started_at` est donc
  // toujours fixé par le serveur, jamais transmis par ce composant.
  const [attemptId, setAttemptId] = useState<string | null>(null);
  // Incrémenté après chaque soumission réussie, pour forcer QuizHistory à
  // recharger et faire apparaître la tentative qui vient d'être enregistrée
  // sans recharger la page.
  const [historyRefreshToken, setHistoryRefreshToken] = useState(0);

  if (quiz.length === 0) return null;

  const score = answers.filter((selected, i) => isAnswerCorrect(quiz[i], selected)).length;

  function toggleChoice(choiceIndex: number) {
    const question = quiz[currentIndex];
    setAnswers((prev) => {
      const next = [...prev];
      if (isMultipleChoice(question)) {
        const current = next[currentIndex];
        next[currentIndex] = current.includes(choiceIndex)
          ? current.filter((i) => i !== choiceIndex)
          : sortedUnique([...current, choiceIndex]);
      } else {
        // single_choice / true_false : une sélection remplace la précédente.
        next[currentIndex] = [choiceIndex];
      }
      return next;
    });
  }

  function start() {
    setPhase("active");
    if (quizId) {
      // Fire-and-forget, comme le reste du tracking de progression de
      // l'app : ne bloque jamais le démarrage visuel du quiz.
      startQuizAttempt(quizId).then(setAttemptId);
    }
  }

  function goNext() {
    if (currentIndex < quiz.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setPhase("results");
      // Le score affiché ci-dessus reste calculé localement (comportement
      // visuel inchangé). Ce qui est enregistré en base est entièrement
      // recalculé côté serveur à partir des vraies bonnes réponses — les
      // réponses envoyées ici ne contiennent jamais de score ni de total.
      const submittedAnswers = quiz
        .map((question, i): SubmittedQuizAnswer | null => {
          if (!question.id) return null;
          if (isMultipleChoice(question)) {
            return { questionId: question.id, selectedChoiceIndexes: answers[i] };
          }
          return { questionId: question.id, selectedChoiceIndex: answers[i][0] ?? null };
        })
        .filter((a): a is SubmittedQuizAnswer => a !== null);
      submitQuizAttempt(attemptId, submittedAnswers).then((result) => {
        if (result) setHistoryRefreshToken((t) => t + 1);
      });
    }
  }

  function restart() {
    setAnswers(Array.from({ length: quiz.length }, () => []));
    setCurrentIndex(0);
    setReviewFilter("all");
    setAttemptId(null);
    setPhase("intro");
  }

  const visibleQuestions = quiz
    .map((question, i) => ({ question, i }))
    .filter(({ question, i }) => reviewFilter === "all" || !isAnswerCorrect(question, answers[i]));

  return (
    <>
      <section className="mt-8">
        <Card variant="elevated">
          {phase === "intro" && (
            <div className="flex flex-col items-center py-6 text-center">
              <h2 className="text-lg font-semibold text-foreground">{title}</h2>
              <p className="mt-2 max-w-sm text-sm text-foreground-muted">
                {quiz.length} questions {description}
              </p>
              <Button onClick={start} className="mt-6">
                Commencer le quiz
              </Button>
            </div>
          )}

          {phase === "active" && (
            <QuestionCard
              question={quiz[currentIndex]}
              index={currentIndex}
              total={quiz.length}
              selected={answers[currentIndex]}
              onToggle={toggleChoice}
              onNext={goNext}
            />
          )}

          {phase === "results" && (
            <div>
              <div className="flex flex-col items-center text-center">
                <h2 className="text-lg font-semibold text-foreground">
                  Résultat du quiz
                </h2>
                <p className="mt-2 text-4xl font-semibold tracking-tight text-foreground">
                  {score}
                  <span className="text-foreground-muted">/{quiz.length}</span>
                </p>
                <p className="mt-1 text-sm text-foreground-muted">
                  {score === quiz.length
                    ? "Sans fautes, bravo !"
                    : score >= quiz.length * 0.7
                      ? "Belle maîtrise du sujet."
                      : "Revois les points ci-dessous pour consolider."}
                </p>
              </div>

              <div className="mt-6 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setReviewFilter("all")}
                  className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
                    reviewFilter === "all"
                      ? "border-accent-violet/40 bg-accent-violet/10 text-foreground"
                      : "border-border-subtle bg-white/[0.03] text-foreground-muted hover:bg-white/[0.06]"
                  }`}
                >
                  Toutes les questions
                </button>
                <button
                  type="button"
                  onClick={() => setReviewFilter("mistakes")}
                  className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
                    reviewFilter === "mistakes"
                      ? "border-accent-violet/40 bg-accent-violet/10 text-foreground"
                      : "border-border-subtle bg-white/[0.03] text-foreground-muted hover:bg-white/[0.06]"
                  }`}
                >
                  Mes erreurs uniquement
                </button>
              </div>

              <div className="mt-6 space-y-4">
                {visibleQuestions.length === 0 && (
                  <p className="text-center text-sm text-foreground-muted">
                    Aucune erreur — bien joué !
                  </p>
                )}
                {visibleQuestions.map(({ question, i }) => (
                  <ReviewQuestion
                    key={i}
                    question={question}
                    index={i}
                    selected={answers[i]}
                  />
                ))}
              </div>

              <div className="mt-8 flex justify-center">
                <Button variant="secondary" onClick={restart}>
                  Refaire le quiz
                </Button>
              </div>
            </div>
          )}
        </Card>
      </section>

      {phase !== "active" && (
        <QuizHistory quizId={quizId} refreshToken={historyRefreshToken} />
      )}
    </>
  );
}

function QuestionCard({
  question,
  index,
  total,
  selected,
  onToggle,
  onNext,
}: {
  question: QuizQuestion;
  index: number;
  total: number;
  selected: number[];
  onToggle: (choiceIndex: number) => void;
  onNext: () => void;
}) {
  const multiple = isMultipleChoice(question);
  const trueFalse = question.questionType === "true_false";

  return (
    <div>
      <span className="text-xs font-mono text-accent-violet-light">
        Question {index + 1}/{total}
      </span>
      <h3 className="mt-2 text-lg font-semibold leading-snug text-foreground">
        {question.question}
      </h3>
      {multiple && (
        <p className="mt-1.5 text-xs font-medium uppercase tracking-wide text-accent-blue-light">
          Plusieurs réponses possibles
        </p>
      )}

      {trueFalse ? (
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          {question.choices.map((choice, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onToggle(i)}
              className={`rounded-xl border px-4 py-4 text-center text-sm font-medium transition-colors ${
                selected.includes(i)
                  ? "border-accent-violet/60 bg-accent-violet/10 text-foreground"
                  : "border-border-subtle bg-white/[0.02] text-foreground-muted hover:bg-white/[0.05]"
              }`}
            >
              {choice}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-5 space-y-2.5">
          {question.choices.map((choice, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onToggle(i)}
              className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                selected.includes(i)
                  ? "border-accent-violet/60 bg-accent-violet/10 text-foreground"
                  : "border-border-subtle bg-white/[0.02] text-foreground-muted hover:bg-white/[0.05]"
              }`}
            >
              {multiple && (
                <span
                  aria-hidden
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                    selected.includes(i)
                      ? "border-accent-violet bg-accent-violet"
                      : "border-border-subtle"
                  }`}
                >
                  {selected.includes(i) && (
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
              )}
              <span>{choice}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <Button onClick={onNext} disabled={selected.length === 0}>
          {index === total - 1 ? "Voir mon score" : "Suivant"}
        </Button>
      </div>
    </div>
  );
}

function ReviewQuestion({
  question,
  index,
  selected,
}: {
  question: QuizQuestion;
  index: number;
  selected: number[];
}) {
  const multiple = isMultipleChoice(question);
  const correctIndexes = new Set(
    multiple ? question.correctChoiceIndexes ?? [] : [question.correctChoiceIndex],
  );
  const selectedIndexes = new Set(selected);
  const isCorrect = isAnswerCorrect(question, selected);

  return (
    <div className="rounded-2xl border border-border-subtle bg-white/[0.02] p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-foreground">
          {index + 1}. {question.question}
        </p>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
            isCorrect
              ? "bg-emerald-500/10 text-emerald-300"
              : "bg-red-500/10 text-red-300"
          }`}
        >
          {isCorrect ? "Correct" : "Incorrect"}
        </span>
      </div>

      <div className="mt-3 space-y-1.5">
        {question.choices.map((choice, i) => {
          const isCorrectChoice = correctIndexes.has(i);
          const isUserChoice = selectedIndexes.has(i);
          return (
            <p
              key={i}
              className={`rounded-lg px-3 py-2 text-sm ${
                isCorrectChoice
                  ? "bg-emerald-500/10 text-emerald-300"
                  : isUserChoice
                    ? "bg-red-500/10 text-red-300"
                    : "text-foreground-muted"
              }`}
            >
              {choice}
              {isCorrectChoice && " ✓"}
              {isUserChoice && !isCorrectChoice && " (ta réponse)"}
            </p>
          );
        })}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-foreground-muted">
        <span className="font-medium text-foreground-muted/90">Explication : </span>
        {question.explanation}
      </p>
    </div>
  );
}
