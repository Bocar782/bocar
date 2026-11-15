"use client";

import { useState } from "react";
import type { QuizQuestion } from "@/lib/courses/schemas";

type Phase = "intro" | "active" | "results";
type ReviewFilter = "all" | "mistakes";

export function QuizView({ quiz }: { quiz: QuizQuestion[] }) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(
    Array(quiz.length).fill(null),
  );
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");

  if (quiz.length === 0) return null;

  const score = answers.filter(
    (answer, i) => answer !== null && answer === quiz[i].correctChoiceIndex,
  ).length;

  function selectChoice(choiceIndex: number) {
    setAnswers((prev) => {
      const next = [...prev];
      next[currentIndex] = choiceIndex;
      return next;
    });
  }

  function goNext() {
    if (currentIndex < quiz.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setPhase("results");
    }
  }

  function restart() {
    setAnswers(Array(quiz.length).fill(null));
    setCurrentIndex(0);
    setReviewFilter("all");
    setPhase("intro");
  }

  const visibleQuestions = quiz
    .map((question, i) => ({ question, i }))
    .filter(
      ({ i }) =>
        reviewFilter === "all" || answers[i] !== quiz[i].correctChoiceIndex,
    );

  return (
    <section className="relative mt-8 rounded-[28px] p-px">
      <div
        aria-hidden
        className="absolute inset-0 rounded-[28px] bg-gradient-to-br from-accent-blue/40 via-white/10 to-accent-violet/40"
      />
      <div className="relative rounded-[28px] bg-background-elevated/90 p-6 sm:p-8">
        {phase === "intro" && (
          <div className="flex flex-col items-center py-6 text-center">
            <h2 className="text-lg font-semibold text-foreground">Quiz final</h2>
            <p className="mt-2 max-w-sm text-sm text-foreground-muted">
              {quiz.length} questions pour vérifier ce que tu as retenu de cette
              formation.
            </p>
            <button
              type="button"
              onClick={() => setPhase("active")}
              className="mt-6 rounded-full bg-gradient-to-r from-accent-blue to-accent-violet px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_30px_-8px_var(--accent-violet)] transition-all hover:brightness-110"
            >
              Commencer le quiz
            </button>
          </div>
        )}

        {phase === "active" && (
          <QuestionCard
            question={quiz[currentIndex]}
            index={currentIndex}
            total={quiz.length}
            selected={answers[currentIndex]}
            onSelect={selectChoice}
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
              <button
                type="button"
                onClick={restart}
                className="rounded-full border border-border-subtle bg-white/5 px-5 py-2.5 text-sm text-foreground-muted transition-colors hover:bg-white/10"
              >
                Refaire le quiz
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function QuestionCard({
  question,
  index,
  total,
  selected,
  onSelect,
  onNext,
}: {
  question: QuizQuestion;
  index: number;
  total: number;
  selected: number | null;
  onSelect: (choiceIndex: number) => void;
  onNext: () => void;
}) {
  return (
    <div>
      <span className="text-xs font-mono text-accent-violet-light">
        Question {index + 1}/{total}
      </span>
      <h3 className="mt-2 text-lg font-semibold leading-snug text-foreground">
        {question.question}
      </h3>

      <div className="mt-5 space-y-2.5">
        {question.choices.map((choice, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(i)}
            className={`block w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
              selected === i
                ? "border-accent-violet/60 bg-accent-violet/10 text-foreground"
                : "border-border-subtle bg-white/[0.02] text-foreground-muted hover:bg-white/[0.05]"
            }`}
          >
            {choice}
          </button>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={onNext}
          disabled={selected === null}
          className="rounded-full bg-gradient-to-r from-accent-blue to-accent-violet px-6 py-2.5 text-sm font-semibold text-white shadow-[0_8px_30px_-8px_var(--accent-violet)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {index === total - 1 ? "Voir mon score" : "Suivant"}
        </button>
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
  selected: number | null;
}) {
  const isCorrect = selected === question.correctChoiceIndex;

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
          const isCorrectChoice = i === question.correctChoiceIndex;
          const isUserChoice = i === selected;
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
