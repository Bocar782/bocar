"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ChapterChat } from "@/components/chapter-chat";
import { CourseView } from "@/components/course-view";
import { GenerationProgress } from "@/components/generation-progress";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { FREE_PLAN_UNLOCKED_CHAPTERS } from "@/lib/courses/plan";
import type { GeneratedCourse, GenerationStage } from "@/lib/courses/schemas";

type Status = "idle" | "generating" | "done" | "error";

type StreamEvent = {
  stage: GenerationStage | "done" | "error";
  label?: string;
  course?: GeneratedCourse;
  courseId?: string | null;
  message?: string;
  saveWarning?: string | null;
};

const MAX_LENGTH = 500;

export function CourseGenerator({
  remainingGenerations,
  locked,
}: {
  remainingGenerations: number;
  locked: boolean;
}) {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [stage, setStage] = useState<GenerationStage>("analyse");
  const [course, setCourse] = useState<GeneratedCourse | null>(null);
  const [courseId, setCourseId] = useState<string | null>(null);
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
    setStage("analyse");
    setError(null);
    setCourse(null);

    try {
      const response = await fetch("/api/courses/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: trimmed }),
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Impossible de lancer la génération.");
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
            throw new Error(parsed.message ?? "La génération a échoué.");
          }
          if (parsed.stage === "done" && parsed.course) {
            setCourse(parsed.course);
            setCourseId(parsed.courseId ?? null);
            setSaveWarning(parsed.saveWarning ?? null);
            setStatus("done");
            router.refresh();
            continue;
          }
          setStage(parsed.stage as GenerationStage);
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
    setCourse(null);
    setCourseId(null);
    setError(null);
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
            placeholder="Que veux-tu apprendre ?"
            rows={2}
            maxLength={MAX_LENGTH}
            className="max-h-60 w-full resize-none bg-transparent px-3 py-4 text-xl leading-relaxed text-foreground placeholder:text-foreground-muted/70 focus:outline-none"
          />
          <div className="flex items-center justify-between border-t border-border-subtle px-3 pt-3">
            <span className="text-xs text-foreground-muted">
              {topic.length}/{MAX_LENGTH}
            </span>
            <Button type="submit" disabled={isEmpty}>
              Générer ma formation
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
