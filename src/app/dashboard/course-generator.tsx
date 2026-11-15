"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CourseView } from "@/components/course-view";
import { GenerationProgress } from "@/components/generation-progress";
import type { GeneratedCourse, GenerationStage } from "@/lib/courses/schemas";

type Status = "idle" | "generating" | "done" | "error";

type StreamEvent = {
  stage: GenerationStage | "done" | "error";
  label?: string;
  course?: GeneratedCourse;
  message?: string;
  saveWarning?: string | null;
};

const MAX_LENGTH = 500;

export function CourseGenerator() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [stage, setStage] = useState<GenerationStage>("analyse");
  const [course, setCourse] = useState<GeneratedCourse | null>(null);
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
    setError(null);
  }

  if (status === "done" && course) {
    return (
      <div className="flex w-full flex-col items-center">
        {saveWarning && (
          <p className="mb-6 max-w-2xl rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-center text-sm text-amber-300">
            Ta formation est prête mais n&apos;a pas pu être sauvegardée ({saveWarning}). Elle ne sera pas visible après avoir quitté cette page.
          </p>
        )}
        <CourseView course={course} />
        <button
          type="button"
          onClick={startOver}
          className="mt-8 rounded-full border border-border-subtle bg-white/5 px-5 py-2.5 text-sm text-foreground-muted transition-colors hover:bg-white/10"
        >
          Générer une autre formation
        </button>
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

  return (
    <div className="w-full max-w-2xl">
      {error && (
        <p className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          {error}
        </p>
      )}
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
            <button
              type="submit"
              disabled={isEmpty}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-accent-blue to-accent-violet px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_30px_-8px_var(--accent-violet)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Générer ma formation
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
